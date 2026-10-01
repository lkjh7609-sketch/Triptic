/**
 * Supabase 데이터베이스 서비스 (새 React 앱 전용 — src/services/supabaseService.js 이식)
 *
 * ⚠️ ADR-002 M7 컷오버(2026-09-21): Plan 탭의 1차 데이터가 `trips.snapshot`
 * (JSONB)에서 정규화 테이블(trip_days/itinerary_items/legs/expenses)로
 * 바뀌었다. `LocalProject`/`TripRow.content`의 모양은 예전 snapshot과 완전히
 * 동일하게 유지한다 — TripDetailScreen/모든 모달/PlanScreen/BackupModal/
 * sampleTrip.ts는 전혀 안 바꿔도 되도록, 저장 방식만 이 파일 안에서 교체한
 * 것이다("JSON 계약을 그대로 유지한 채 저장소만 교체", plan 참고).
 * - 쓰기: `trip-itinerary-write` Edge Function(구 sync-trip-normalized)이
 *   `replace_trip_itinerary()` RPC로 한 트립의 파생 테이블 전체를 원자적으로
 *   교체한다. 예전엔 이게 fire-and-forget 파생 동기화였지만 지금은 유일한
 *   쓰기 경로라 saveTrip()이 await하고 실패를 전파한다.
 * - 읽기: `get_trip_itinerary_raw()` RPC로 정규화 테이블 원본을 받아
 *   `itineraryTransform.ts`의 `reconstructTripContent()`로 예전 snapshot
 *   모양으로 되돌린다.
 */
import i18next from '@/shared/i18n';
import { getSupabaseClient } from './supabaseClient';
import { generateShortId } from '@/shared/utils/id';
import { captureError, track } from '@/shared/monitoring';
import { can } from '@/shared/entitlements';
import { showToast } from '@/shared/ui/toast';
import { forkDates, shiftYmd } from '@/features/plan/forkDates';
import { reconstructTripContent, type TripItineraryRaw, type TripDayRow, type ItineraryItemRow } from '@/features/plan/itineraryTransform';

/** allProjects[name] 형태의 로컬 프로젝트 (2.x, snapshot 스키마) */
export interface LocalProject {
  supabaseId?: string;
  city?: string | null;
  cityLat?: number | null;
  cityLng?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  totalDays?: number | null;
  currency?: string | null;
  data?: unknown;
  hotels?: unknown;
  meals?: unknown;
  expenses?: unknown;
  flights?: { outbound: unknown; return: unknown } | null;
  dayCities?: unknown;
  updatedAt?: number;
  /** 불러온 시점의 trips.revision(0058) — 있으면 그 버전일 때만 저장한다(동시 편집 덮어쓰기 방지) */
  revision?: number;
}

/** 저장하려는 사이 이 여행이 먼저 바뀌었다 — 최신 내용을 다시 불러와야 한다.
 * byOther: 다른 동행자가 바꿨는지(아니면 내가 연달아 저장한 게 겹친 것) */
export class TripConflictError extends Error {
  constructor(readonly byOther: boolean) {
    super('trip_conflict');
    this.name = 'TripConflictError';
  }
}

/** 무료 여행 생성 한도에 걸렸다(서버 트리거 0037·0061이 실제 경계) — 메시지는 화면에 그대로 보여 줄 수 있다 */
export class TripLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TripLimitError';
  }
}

/** trips.snapshot이 갖던 것과 동일한 모양의 콘텐츠 — 이제 DB 컬럼이 아니라
 * 정규화 테이블에서 매번 재구성된다(TripRow.content). */
export interface TripContent {
  data?: unknown;
  hotels?: unknown;
  meals?: unknown;
  expenses?: unknown;
  flights?: { outbound: unknown; return: unknown };
  dayCities?: unknown;
}

/** public.trips 행 + 정규화 테이블에서 재구성한 콘텐츠 */
export interface TripRow {
  id: string;
  owner_id: string;
  title: string;
  city: string | null;
  city_lat: number | null;
  city_lng: number | null;
  start_date: string | null;
  end_date: string | null;
  total_days: number | null;
  base_currency: string | null;
  status: 'planning' | 'ongoing' | 'completed' | 'archived';
  /** 정규화 테이블에서 재구성한 콘텐츠. listTrips()처럼 상세 콘텐츠가
   * 필요 없는 목록 조회에서는 채우지 않는다(비용이 드는 RPC라서). */
  content?: TripContent;
  /** 커뮤니티 글에서 복제(포크)해 만든 여행이면 원본 trip id (0036) */
  forked_from_trip_id?: string | null;
  /** null이면 편집 가능, 값이 있으면 보기 전용(일정 완료) — 0037 */
  finalized_at?: string | null;
  /** 완료 후 재편집한 횟수 — 무료 사용자는 여행당 5회까지(0037) */
  reopen_count?: number;
  /** 행이 바뀔 때마다 1씩 오른다(0058) */
  revision?: number;
  /** 마지막으로 고친 사람(0058) */
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
}

/** get_post_trip() RPC(0036_post_trip_view.sql)가 반환하는 형태 —
 * get_shared_trip과 같은 최소 노출 원칙(경비/서류/예약확정서 제외) */
export interface PostTripPayload {
  trip: {
    id: string;
    title: string;
    city: string | null;
    city_lat: number | null;
    city_lng: number | null;
    start_date: string;
    end_date: string;
    total_days: number | null;
    base_currency: string;
  };
  days: TripDayRow[];
  items: ItineraryItemRow[];
  legs: unknown[];
  /** 작성자가 "일정 복사 허용"을 켰는지(0070). 없으면(아직 0070 전) 허용으로 본다 */
  allow_copy?: boolean;
}

export class TripService {
  async getCurrentUser() {
    const supabase = getSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user ?? null;
  }

  /** 여행 저장 (신규 생성 또는 갱신) */
  async saveTrip(project: LocalProject, name: string): Promise<TripRow> {
    const supabase = getSupabaseClient();
    const user = await this.getCurrentUser();
    if (!user) throw new Error('Not signed in');

    const isNewTrip = !project.supabaseId;
    if (isNewTrip && !can('trip.create', { userId: user.id })) {
      throw new TripLimitError(i18next.t('plan:errors.tripLimit'));
    }

    const content: TripContent = {
      data: project.data || {},
      hotels: project.hotels || {},
      meals: project.meals || {},
      expenses: project.expenses || {},
      flights: project.flights || { outbound: null, return: null },
      dayCities: project.dayCities || {},
    };

    const fields: Record<string, unknown> = {
      title: name,
      city: project.city || null,
      city_lat: project.cityLat ?? null,
      city_lng: project.cityLng ?? null,
      start_date: project.startDate || null,
      end_date: project.endDate || null,
      total_days: project.totalDays || null,
      base_currency: project.currency || 'KRW',
    };

    let data: Omit<TripRow, 'content'>;
    if (isNewTrip) {
      const res = await supabase.from('trips').insert({ ...fields, owner_id: user.id }).select().single();
      if (res.error) {
        // 무료 사용자 평생 생성 2개 한도 — 서버 트리거(0037)가 실제 경계다.
        if (res.error.hint === 'trip_limit_reached') {
          track('trip_limit_reached');
          throw new TripLimitError(i18next.t('plan:errors.tripLimit'));
        }
        throw res.error;
      }
      data = res.data as Omit<TripRow, 'content'>;
    } else {
      // 기존 여행은 소유자가 아니어도(편집 멤버) 고칠 수 있으므로 owner_id를 보내지 않는다(0056).
      // 불러온 revision이 있으면 그 버전일 때만 고친다 — 그 사이 다른 동행자가 저장했으면 0행.
      let query = supabase.from('trips').update(fields).eq('id', project.supabaseId!);
      if (project.revision !== undefined) query = query.eq('revision', project.revision);
      const res = await query.select().maybeSingle();
      if (res.error) throw res.error;
      if (res.data) {
        data = res.data as Omit<TripRow, 'content'>;
      } else if (project.revision !== undefined) {
        // 누가 바꿨는지 봐서 안내를 고른다 — 혼자 편집하다 저장이 겹친 걸 남 탓으로 보이지 않게
        const { data: latest } = await supabase
          .from('trips')
          .select('updated_by')
          .eq('id', project.supabaseId!)
          .maybeSingle();
        throw new TripConflictError(!!latest?.updated_by && latest.updated_by !== user.id);
      } else {
        // 예전 백업/로컬 이관처럼 revision 없이 id만 들고 온 경우 — 행이 없으면 예전 upsert처럼 만든다
        const ins = await supabase
          .from('trips')
          .insert({ ...fields, id: project.supabaseId, owner_id: user.id })
          .select()
          .single();
        if (ins.error) throw ins.error;
        data = ins.data as Omit<TripRow, 'content'>;
      }
    }
    const tripId = data.id;

    // ADR-002 M7 컷오버 — 정규화 테이블이 이제 1차 데이터라 이 호출이
    // 실패하면 저장 자체가 실패해야 한다(예전 fire-and-forget과 다름).
    const { error: fnErr } = await supabase.functions.invoke('trip-itinerary-write', {
      body: { tripId, ...content },
    });
    if (fnErr) {
      captureError(fnErr, { context: 'tripItineraryWrite', tripId });
      throw fnErr;
    }

    // 일정까지 다 바뀐 뒤 trips 행을 한 번 더 건드려 "저장 끝" 신호를 realtime으로 보낸다 —
    // 첫 수정 신호만 받고 다시 읽으면 일정이 아직 예전 것일 수 있다. 그 사이 다른 사람이
    // 저장했으면(0행) 그 사람의 신호로 다시 읽게 두고 방금 받은 행을 그대로 쓴다.
    if (!isNewTrip) {
      const touched = await supabase
        .from('trips')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', tripId)
        .eq('revision', data.revision ?? 0)
        .select()
        .maybeSingle();
      if (touched.data) data = touched.data as Omit<TripRow, 'content'>;
    }

    if (isNewTrip) await this.notifyQuotaAfterCreate(user.id);

    return { ...data, content };
  }

  /** 새 여행 생성 직후 무료 사용자에게 남은 횟수를 토스트로 안내한다(요구사항:
   * "횟수가 하나씩 차감될 때마다 사용자에게 토스트알람"). 실패해도 저장 자체는
   * 이미 끝난 뒤라 조용히 무시한다(안내가 실제 게이트는 아니다). */
  private async notifyQuotaAfterCreate(userId: string): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      const { data: profile } = await supabase
        .from('profiles')
        .select('plan, trips_created_count, trip_limit')
        .eq('id', userId)
        .maybeSingle();
      if (!profile || profile.plan !== 'free') return;
      const remaining = Math.max(0, (profile.trip_limit as number) - (profile.trips_created_count as number));
      showToast(i18next.t('plan:quota.tripCreatedToast', { remaining }), { tone: 'success' });
    } catch {
      // 안내용 토스트일 뿐이라 실패해도 무시한다.
    }
  }

  /** 여행 삭제 */
  async deleteTrip(tripId: string): Promise<void> {
    if (!tripId) return;
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('trips').delete().eq('id', tripId);
    if (error) throw error;
  }

  /** 함께하는 여행에서 나가기(소유자가 아닌 멤버만, 0056) */
  async leaveTrip(tripId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const user = await this.getCurrentUser();
    if (!user) throw new Error('Not signed in');
    const { error } = await supabase.from('trip_members').delete().eq('trip_id', tripId).eq('user_id', user.id);
    if (error) throw error;
  }

  /** 소유자가 멤버를 내보낸다 */
  async removeTripMember(tripId: string, userId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('trip_members').delete().eq('trip_id', tripId).eq('user_id', userId);
    if (error) throw error;
  }

  /** 로그인한 사용자의 모든 여행 목록 조회 — 내가 만든 여행 + 공유 링크로 참여한 여행.
   * 어느 여행이 보이는지는 trips 조회 정책(소유자 또는 멤버, 0056)이 정한다. */
  async listTrips(): Promise<TripRow[]> {
    const supabase = getSupabaseClient();
    const user = await this.getCurrentUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return (data as TripRow[]) ?? [];
  }

  /** 여행 목록 카드용 경량 요약(완성도/장소 수/호텔·항공 여부) — listTrips()가
   * 채우지 않는 content 대신, 정규화 테이블을 집계만 하는 RPC로 가져온다
   * (0034_trip_summary_rpc.sql). 이 앱은 쿼리 캐시 전체를 IndexedDB에
   * JSON으로 영속화하므로(offline/persister.ts) Map을 반환하면 안 된다 —
   * 직렬화되며 Map이 빈 객체 `{}`가 돼 다음 실행에서 `.get is not a
   * function`으로 죽는다. trip_id를 키로 쓰는 평범한 객체로 반환한다. */
  async listTripSummaries(): Promise<Record<string, { plannedDays: number; placeCount: number; hasHotel: boolean; hasFlight: boolean }>> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc('get_trip_summaries');
    if (error) throw error;
    const result: Record<string, { plannedDays: number; placeCount: number; hasHotel: boolean; hasFlight: boolean }> = {};
    for (const row of (data ?? []) as { trip_id: string; planned_days: number; place_count: number; has_hotel: boolean; has_flight: boolean }[]) {
      result[row.trip_id] = {
        plannedDays: row.planned_days,
        placeCount: row.place_count,
        hasHotel: row.has_hotel,
        hasFlight: row.has_flight,
      };
    }
    return result;
  }

  /** 단일 여행 조회 (여행 상세 화면용) — 정규화 테이블에서 콘텐츠를 재구성해 붙인다 */
  async getTrip(tripId: string): Promise<TripRow | null> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('trips').select('*').eq('id', tripId).maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const { data: raw, error: rawErr } = await supabase.rpc('get_trip_itinerary_raw', { p_trip_id: tripId });
    if (rawErr) throw rawErr;

    const content = reconstructTripContent(raw as TripItineraryRaw, {
      name: data.city,
      lat: data.city_lat,
      lng: data.city_lng,
    });
    return { ...(data as Omit<TripRow, 'content'>), content };
  }

  /** Supabase trips 행을 로컬 프로젝트(allProjects[name]) 형식으로 변환 */
  toLocalProject(row: TripRow): LocalProject {
    const content = row.content || {};
    return {
      supabaseId: row.id,
      city: row.city || '',
      cityLat: row.city_lat,
      cityLng: row.city_lng,
      startDate: row.start_date || '',
      endDate: row.end_date || '',
      totalDays: row.total_days || 0,
      currency: row.base_currency || 'KRW',
      data: content.data || {},
      hotels: content.hotels || {},
      meals: content.meals || {},
      expenses: content.expenses || {},
      flights: content.flights || { outbound: null, return: null },
      dayCities: content.dayCities || {},
      updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
      revision: row.revision,
    };
  }

  // ── 공유 링크 ──────────────────────────────────────────────────

  /** 공유 링크 생성(또는 이미 있으면 재사용) */
  async createShareLink(tripId: string): Promise<string> {
    const supabase = getSupabaseClient();
    const user = await this.getCurrentUser();
    if (!can('trip.collaborate', { userId: user?.id ?? null })) {
      throw new Error(i18next.t('plan:errors.shareUnavailable'));
    }

    const { data: existing } = await supabase
      .from('shared_trips')
      .select('share_code')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.share_code) return existing.share_code as string;

    const shareCode = generateShortId(10);
    const { error } = await supabase
      .from('shared_trips')
      .insert({ trip_id: tripId, share_code: shareCode });

    if (error) throw error;
    return shareCode;
  }

  /** 공유 중단 — 새로 참여하는 것만 막는다. 이미 참여한 멤버는 남는다(내보내기는 따로) */
  async revokeShareLinks(tripId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('shared_trips').delete().eq('trip_id', tripId);
    if (error) throw error;
  }

  /** 공유 링크로 이 여행의 편집 멤버가 된다(로그인 필요, 0057). 코드가 없거나 만료됐으면 null.
   * 소유자 본인이면 가입 없이 trip id만 돌려주고, 이미 멤버면 그대로다. */
  async joinTripByShareCode(shareCode: string): Promise<string | null> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc('join_trip_by_share_code', { p_share_code: shareCode });
    if (error) throw error;
    return (data as string | null) ?? null;
  }

  /** 커뮤니티 글에 첨부된 일정 읽기 전용 조회 — get_post_trip RPC가 글이
   * published 상태일 때만 반환한다(0036_post_trip_view.sql) */
  async getPostTrip(postId: string): Promise<PostTripPayload | null> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc('get_post_trip', { p_post_id: postId });
    if (error) throw error;
    return (data as PostTripPayload | null) ?? null;
  }

  /** 다른 사람의 공개 일정을 내 계정으로 복제 — 경비/서류/예약확정서는 복사하지
   * 않는다(원래 get_shared_trip과 같은 최소 노출 원칙, days/items/hotels/
   * flights만). forked_from_trip_id에 원본을 남겨 둔다.
   * startDate를 주면 일 수는 그대로 두고 그 날부터 이어지게 날짜를 옮긴다(항공편 날짜도 같이).
   * 작성자가 복사를 허용하지 않은 글(allow_copy === false, 0070)은 복사하지 않는다 —
   * 값이 없으면(아직 0070 전) 예전처럼 허용이다. */
  async forkPostTrip(postId: string, newTitle: string, startDate?: string | null): Promise<TripRow> {
    const payload = await this.getPostTrip(postId);
    if (!payload) throw new Error('Trip not found or not published');
    if (payload.allow_copy === false) throw new Error('Copying is not allowed for this post');
    const content = reconstructTripContent(
      { days: payload.days, items: payload.items, expenses: [] },
      { name: payload.trip.city, lat: payload.trip.city_lat, lng: payload.trip.city_lng },
    );
    const totalDays = payload.trip.total_days ?? payload.days.length;
    const dates = forkDates(payload.trip.start_date, totalDays, startDate);
    const flights = content.flights;
    if (dates.offsetDays !== 0) {
      for (const leg of ['outbound', 'return'] as const) {
        const f = flights[leg];
        if (f?.date) flights[leg] = { ...f, date: shiftYmd(f.date, dates.offsetDays) };
      }
    }
    const project: LocalProject = {
      city: payload.trip.city,
      cityLat: payload.trip.city_lat,
      cityLng: payload.trip.city_lng,
      startDate: dates.startDate,
      endDate: dates.endDate,
      totalDays: payload.trip.total_days,
      currency: payload.trip.base_currency,
      data: content.data,
      hotels: content.hotels,
      meals: content.meals,
      flights,
      dayCities: content.dayCities,
    };
    const row = await this.saveTrip(project, newTitle);
    // 원본 표시는 서버 관리 컬럼이라 직접 UPDATE하면 막힌다(0041) — 0070의 set_forked_from_trip RPC로 남긴다.
    // 이미 만들어진 사본이 사라지는 게 더 나쁘므로, 표시를 못 남겨도(예: 0070 적용 전) 복사 자체는 성공으로 친다
    const { error } = await getSupabaseClient().rpc('set_forked_from_trip', { p_trip_id: row.id, p_source_trip_id: payload.trip.id });
    if (error) {
      captureError(error, { context: 'setForkedFromTrip' });
      return row;
    }
    return { ...row, forked_from_trip_id: payload.trip.id } as TripRow;
  }

  /** 일정 완료(보기 전용 잠금) — 소유자만, 이미 완료면 서버에서 에러(0037) */
  async finalizeTrip(tripId: string): Promise<void> {
    const { error } = await getSupabaseClient().rpc('finalize_trip', { p_trip_id: tripId });
    if (error) throw error;
  }

  /** 재편집(잠금 해제) — 무료 사용자는 여행당 5회까지(0037) */
  async reopenTrip(tripId: string): Promise<number> {
    const { data, error } = await getSupabaseClient().rpc('reopen_trip', { p_trip_id: tripId });
    if (error) {
      if (error.hint === 'reopen_limit_reached') {
        throw new Error(i18next.t('plan:errors.reopenLimit'));
      }
      throw error;
    }
    return data as number;
  }

  // ── 마이그레이션 ───────────────────────────────────────────────

  /** localStorage의 모든 프로젝트를 Supabase로 업로드 */
  async migrateFromLocalStorage(localProjects: Record<string, LocalProject>): Promise<number> {
    const names = Object.keys(localProjects || {});
    let migratedCount = 0;

    for (const name of names) {
      try {
        await this.saveTrip(localProjects[name], name);
        migratedCount++;
      } catch (error) {
        captureError(error, { context: 'migrateFromLocalStorage', name });
      }
    }

    return migratedCount;
  }
}

// 싱글톤 인스턴스
export const tripService = new TripService();
