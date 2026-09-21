/**
 * Supabase 데이터베이스 서비스
 * localStorage를 대체하여 클라우드 동기화, 공유 링크, 동행자 제안을 지원
 *
 * ⚠️ ADR-002 M7 컷오버(2026-09-21): 예전엔 각 여행의 전체 상태를
 * trips.snapshot(JSONB)에 그대로 저장했지만, 이제 정규화 테이블
 * (trip_days/itinerary_items/legs/expenses)이 1차 데이터다. 이 파일이 주고
 * 받는 JSON 모양({data, hotels, meals, expenses, flights, dayCities})은
 * snapshot과 완전히 동일하게 유지한다 — index.html의 렌더링/편집 로직은
 * 전혀 안 바꿔도 되도록, 저장 방식만 이 파일 안에서 교체했다
 * (src/shared/api/tripService.ts의 3.0쪽 컷오버와 동일한 설계).
 *
 * ⚠️ Triptic 3.0 스키마 정합화(supabase/migrations/0000_reconcile_legacy_schema.sql):
 * trips.user_id/name/currency → owner_id/title/base_currency로 컬럼명이 바뀌었다.
 * 이 파일은 그 마이그레이션과 같은 배포 사이클에 맞춰 함께 수정됐다.
 */

import { getSupabaseClient } from './supabaseClient.js';
import { generateShortId } from '../utils/id.js';
import { reconstructTripContent } from '../features/plan/itineraryTransform';

export class SupabaseService {
    /**
     * 현재 로그인한 사용자를 반환 (없으면 null)
     */
    async getCurrentUser() {
        const supabase = await getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        return user || null;
    }

    /**
     * 여행 저장 (신규 생성 또는 갱신)
     * @param {Object} project - 로컬 프로젝트 객체 (allProjects[name] 형태)
     * @param {string} name - 여행 이름
     * @returns {Promise<Object>} 저장된 trips 행 (id, updated_at 포함)
     */
    async saveTrip(project, name) {
        const supabase = await getSupabaseClient();
        const user = await this.getCurrentUser();
        if (!user) throw new Error('인증되지 않은 사용자입니다.');

        const content = {
            data: project.data || {},
            hotels: project.hotels || {},
            meals: project.meals || {},
            expenses: project.expenses || {},
            flights: project.flights || { outbound: null, return: null },
            dayCities: project.dayCities || {}
        };

        const row = {
            owner_id: user.id,
            title: name,
            city: project.city || null,
            city_lat: project.cityLat ?? null,
            city_lng: project.cityLng ?? null,
            start_date: project.startDate || null,
            end_date: project.endDate || null,
            total_days: project.totalDays || null,
            base_currency: project.currency || 'KRW'
        };
        if (project.supabaseId) row.id = project.supabaseId;

        const { data, error } = await supabase
            .from('trips')
            .upsert(row)
            .select()
            .single();

        if (error) throw error;

        // ADR-002 M7 컷오버 — 정규화 테이블이 이제 1차 데이터라 이 호출이
        // 실패하면 저장 자체가 실패해야 한다.
        const { error: fnErr } = await supabase.functions.invoke('trip-itinerary-write', {
            body: { tripId: data.id, ...content }
        });
        if (fnErr) throw fnErr;

        return { ...data, content };
    }

    /**
     * 여행 삭제
     * @param {string} tripId - trips.id (UUID)
     */
    async deleteTrip(tripId) {
        if (!tripId) return;
        const supabase = await getSupabaseClient();
        const { error } = await supabase.from('trips').delete().eq('id', tripId);
        if (error) throw error;
    }

    /**
     * 로그인한 사용자의 모든 여행 목록 조회
     * @returns {Promise<Array>} trips 행 배열 (snapshot 포함)
     */
    /**
     * 로그인한 사용자의 모든 여행 목록 조회. index.html이 이 결과를 한 번에
     * allProjects로 통째로 불러오는 구조라(localStorage 이관 때부터의 설계),
     * 각 트립의 정규화 테이블 콘텐츠를 여기서 미리 재구성해 row.content에
     * 붙여둔다 — toLocalProject()는 그대로 동기 함수로 남긴다.
     */
    async listTrips() {
        const supabase = await getSupabaseClient();
        const user = await this.getCurrentUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('trips')
            .select('*')
            .eq('owner_id', user.id)
            .order('updated_at', { ascending: false });

        if (error) throw error;
        const rows = data || [];

        return Promise.all(rows.map(async (row) => {
            const { data: raw, error: rawErr } = await supabase.rpc('get_trip_itinerary_raw', { p_trip_id: row.id });
            if (rawErr) throw rawErr;
            const content = reconstructTripContent(raw, { name: row.city, lat: row.city_lat, lng: row.city_lng });
            return { ...row, content };
        }));
    }

    /**
     * Supabase trips 행을 로컬 프로젝트(allProjects[name]) 형식으로 변환
     * @param {Object} row - trips 테이블 행(listTrips()가 붙여준 row.content 포함)
     */
    toLocalProject(row) {
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
            updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now()
        };
    }

    // ── 공유 링크 ──────────────────────────────────────────────────

    /**
     * 공유 링크 생성(또는 이미 있으면 재사용)
     * @param {string} tripId
     * @returns {Promise<string>} share_code
     */
    async createShareLink(tripId) {
        const supabase = await getSupabaseClient();

        const { data: existing } = await supabase
            .from('shared_trips')
            .select('share_code')
            .eq('trip_id', tripId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (existing?.share_code) return existing.share_code;

        const shareCode = generateShortId(10);
        const { error } = await supabase
            .from('shared_trips')
            .insert({ trip_id: tripId, share_code: shareCode });

        if (error) throw error;
        return shareCode;
    }

    /**
     * 공유 중단 (이 trip의 모든 공유 링크 삭제 → suggestions도 CASCADE로 함께 삭제됨)
     * @param {string} tripId
     */
    async revokeShareLinks(tripId) {
        const supabase = await getSupabaseClient();
        const { error } = await supabase.from('shared_trips').delete().eq('trip_id', tripId);
        if (error) throw error;
    }

    /**
     * 공유 코드로 여행 조회 (인증 불필요, RPC가 만료/존재 여부를 서버에서 검증)
     * @param {string} shareCode
     * @returns {Promise<Object|null>}
     */
    async getSharedTripByCode(shareCode) {
        const supabase = await getSupabaseClient();
        const { data, error } = await supabase.rpc('get_shared_trip', { p_share_code: shareCode });
        if (error) throw error;
        return data || null;
    }

    // ── 동행자 제안 ────────────────────────────────────────────────

    /**
     * 제안 추가 (공유받은 뷰어가 인증 없이 호출)
     */
    async addSuggestion(tripId, { day, name, address, lat, lng, memo, proposer }) {
        const supabase = await getSupabaseClient();
        const { error } = await supabase.from('suggestions').insert({
            trip_id: tripId, day, name, address, lat, lng, memo, proposer
        });
        if (error) throw error;
    }

    /**
     * 특정 여행에 대해 받은 제안 목록 조회 (소유자만 가능 — RLS)
     */
    async listSuggestions(tripId) {
        const supabase = await getSupabaseClient();
        const { data, error } = await supabase
            .from('suggestions')
            .select('*')
            .eq('trip_id', tripId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    }

    /**
     * 제안 삭제 (수락/거절 공통)
     */
    async deleteSuggestion(suggestionId) {
        const supabase = await getSupabaseClient();
        const { error } = await supabase.from('suggestions').delete().eq('id', suggestionId);
        if (error) throw error;
    }

    // ── 마이그레이션 ───────────────────────────────────────────────

    /**
     * localStorage의 모든 프로젝트를 Supabase로 업로드
     * @param {Object} localProjects - StorageService.load() 결과
     * @returns {Promise<number>} 마이그레이션된 여행 수
     */
    async migrateFromLocalStorage(localProjects) {
        const names = Object.keys(localProjects || {});
        let migratedCount = 0;

        for (const name of names) {
            try {
                await this.saveTrip(localProjects[name], name);
                migratedCount++;
            } catch (error) {
                console.error(`✗ ${name} 마이그레이션 실패:`, error);
            }
        }

        return migratedCount;
    }
}

// 싱글톤 인스턴스
export const supabaseService = new SupabaseService();

export default SupabaseService;
