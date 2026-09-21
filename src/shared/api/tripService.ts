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
import { getSupabaseClient } from './supabaseClient';
import { generateShortId } from '@/utils/id.js';
import { captureError } from '@/shared/monitoring';
import { can } from '@/shared/entitlements';
import { reconstructTripContent, type TripItineraryRaw } from '@/features/plan/itineraryTransform';

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
  created_at: string;
  updated_at: string;
}

export interface Suggestion {
  id: string;
  trip_id: string;
  day: number;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  memo: string | null;
  proposer: string | null;
  created_at: string;
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
    if (!user) throw new Error('인증되지 않은 사용자입니다.');

    const isNewTrip = !project.supabaseId;
    if (isNewTrip && !can('trip.create', { userId: user.id })) {
      throw new Error('여행 생성 한도에 도달했습니다.');
    }

    const content: TripContent = {
      data: project.data || {},
      hotels: project.hotels || {},
      meals: project.meals || {},
      expenses: project.expenses || {},
      flights: project.flights || { outbound: null, return: null },
      dayCities: project.dayCities || {},
    };

    const row: Record<string, unknown> = {
      owner_id: user.id,
      title: name,
      city: project.city || null,
      city_lat: project.cityLat ?? null,
      city_lng: project.cityLng ?? null,
      start_date: project.startDate || null,
      end_date: project.endDate || null,
      total_days: project.totalDays || null,
      base_currency: project.currency || 'KRW',
    };
    if (project.supabaseId) row.id = project.supabaseId;

    const { data, error } = await supabase.from('trips').upsert(row).select().single();
    if (error) throw error;
    const tripId = (data as { id: string }).id;

    // ADR-002 M7 컷오버 — 정규화 테이블이 이제 1차 데이터라 이 호출이
    // 실패하면 저장 자체가 실패해야 한다(예전 fire-and-forget과 다름).
    const { error: fnErr } = await supabase.functions.invoke('trip-itinerary-write', {
      body: { tripId, ...content },
    });
    if (fnErr) {
      captureError(fnErr, { context: 'tripItineraryWrite', tripId });
      throw fnErr;
    }

    return { ...(data as Omit<TripRow, 'content'>), content };
  }

  /** 여행 삭제 */
  async deleteTrip(tripId: string): Promise<void> {
    if (!tripId) return;
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('trips').delete().eq('id', tripId);
    if (error) throw error;
  }

  /** 로그인한 사용자의 모든 여행 목록 조회 */
  async listTrips(): Promise<TripRow[]> {
    const supabase = getSupabaseClient();
    const user = await this.getCurrentUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .eq('owner_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return (data as TripRow[]) ?? [];
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
    };
  }

  // ── 공유 링크 ──────────────────────────────────────────────────

  /** 공유 링크 생성(또는 이미 있으면 재사용) */
  async createShareLink(tripId: string): Promise<string> {
    const supabase = getSupabaseClient();
    const user = await this.getCurrentUser();
    if (!can('trip.collaborate', { userId: user?.id ?? null })) {
      throw new Error('동행자 공유 기능을 사용할 수 없습니다.');
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

  /** 공유 중단 (이 trip의 모든 공유 링크 삭제 → suggestions도 CASCADE로 함께 삭제됨) */
  async revokeShareLinks(tripId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('shared_trips').delete().eq('trip_id', tripId);
    if (error) throw error;
  }

  /** 공유 코드로 여행 조회 (인증 불필요, RPC가 만료/존재 여부를 서버에서 검증) */
  async getSharedTripByCode(shareCode: string): Promise<unknown | null> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc('get_shared_trip', { p_share_code: shareCode });
    if (error) throw error;
    return data ?? null;
  }

  // ── 동행자 제안 ────────────────────────────────────────────────

  /** 제안 추가 (공유받은 뷰어가 인증 없이 호출) */
  async addSuggestion(
    tripId: string,
    suggestion: {
      day: number;
      name: string;
      address?: string | null;
      lat?: number | null;
      lng?: number | null;
      memo?: string | null;
      proposer?: string | null;
    },
  ): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('suggestions')
      .insert({ trip_id: tripId, ...suggestion });
    if (error) throw error;
  }

  /** 특정 여행에 대해 받은 제안 목록 조회 (소유자만 가능 — RLS) */
  async listSuggestions(tripId: string): Promise<Suggestion[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('suggestions')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as Suggestion[]) ?? [];
  }

  /** 제안 삭제 (수락/거절 공통) */
  async deleteSuggestion(suggestionId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('suggestions').delete().eq('id', suggestionId);
    if (error) throw error;
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
