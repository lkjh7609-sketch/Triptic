/**
 * Supabase 데이터베이스 서비스 (새 React 앱 전용 — src/services/supabaseService.js 이식)
 *
 * ⚠️ 이 파일은 아직 정규화 스키마(03-data-model.md §3, itinerary_items/bookings/legs)가
 * 아니라 **snapshot 기반 스키마**를 대상으로 한다 — 단, 컬럼명은
 * supabase/migrations/0000_reconcile_legacy_schema.sql 적용 이후 기준
 * (trips.owner_id/title/base_currency/city/snapshot, profiles)이다.
 * itinerary_items 등 정규화 테이블을 사용하는 새 쿼리 계층은 실제 데이터 이관
 * (M2~M4, 아직 작성 전)이 끝난 뒤 Phase 2에서 추가한다. 그 전까지 계획(Plan) 탭은
 * 이 서비스를 통해 기존 앱과 동일한 데이터를 읽고 써야 패리티 체크리스트
 * (DEVELOPMENT_PLAN.md §10.3)를 통과할 수 있다.
 */
import { getSupabaseClient } from './supabaseClient';
import { generateShortId } from '@/utils/id.js';
import { captureError } from '@/shared/monitoring';

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

/** public.trips 행 (0000 정합화 이후 — snapshot 기반, 정규화 이전) */
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
  snapshot: {
    data?: unknown;
    hotels?: unknown;
    meals?: unknown;
    expenses?: unknown;
    flights?: { outbound: unknown; return: unknown };
    dayCities?: unknown;
  };
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
      snapshot: {
        data: project.data || {},
        hotels: project.hotels || {},
        meals: project.meals || {},
        expenses: project.expenses || {},
        flights: project.flights || { outbound: null, return: null },
        dayCities: project.dayCities || {},
      },
    };
    if (project.supabaseId) row.id = project.supabaseId;

    const { data, error } = await supabase.from('trips').upsert(row).select().single();
    if (error) throw error;
    return data as TripRow;
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

  /** Supabase trips 행을 로컬 프로젝트(allProjects[name]) 형식으로 변환 */
  toLocalProject(row: TripRow): LocalProject {
    const snap = row.snapshot || {};
    return {
      supabaseId: row.id,
      city: row.city || '',
      cityLat: row.city_lat,
      cityLng: row.city_lng,
      startDate: row.start_date || '',
      endDate: row.end_date || '',
      totalDays: row.total_days || 0,
      currency: row.base_currency || 'KRW',
      data: snap.data || {},
      hotels: snap.hotels || {},
      meals: snap.meals || {},
      expenses: snap.expenses || {},
      flights: snap.flights || { outbound: null, return: null },
      dayCities: snap.dayCities || {},
      updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
    };
  }

  // ── 공유 링크 ──────────────────────────────────────────────────

  /** 공유 링크 생성(또는 이미 있으면 재사용) */
  async createShareLink(tripId: string): Promise<string> {
    const supabase = getSupabaseClient();

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
