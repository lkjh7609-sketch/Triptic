/**
 * Supabase 데이터베이스 서비스
 * localStorage를 대체하여 클라우드 동기화, 공유 링크, 동행자 제안을 지원
 *
 * 저장 전략: 각 여행의 전체 상태(plannerData/hotels/meals/expenses/flights/dayCities)를
 * trips.snapshot(JSONB) 컬럼에 그대로 저장한다. supabase/schema.sql의 주석 참고.
 */

import { getSupabaseClient } from './supabaseClient.js';
import { generateShortId } from '../utils/id.js';

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

        const row = {
            user_id: user.id,
            name,
            city: project.city || null,
            city_lat: project.cityLat ?? null,
            city_lng: project.cityLng ?? null,
            start_date: project.startDate || null,
            end_date: project.endDate || null,
            total_days: project.totalDays || null,
            currency: project.currency || 'KRW',
            snapshot: {
                data: project.data || {},
                hotels: project.hotels || {},
                meals: project.meals || {},
                expenses: project.expenses || {},
                flights: project.flights || { outbound: null, return: null },
                dayCities: project.dayCities || {}
            }
        };
        if (project.supabaseId) row.id = project.supabaseId;

        const { data, error } = await supabase
            .from('trips')
            .upsert(row)
            .select()
            .single();

        if (error) throw error;
        return data;
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
    async listTrips() {
        const supabase = await getSupabaseClient();
        const user = await this.getCurrentUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('trips')
            .select('*')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false });

        if (error) throw error;
        return data || [];
    }

    /**
     * Supabase trips 행을 로컬 프로젝트(allProjects[name]) 형식으로 변환
     * @param {Object} row - trips 테이블 행
     */
    toLocalProject(row) {
        const snap = row.snapshot || {};
        return {
            supabaseId: row.id,
            city: row.city || '',
            cityLat: row.city_lat,
            cityLng: row.city_lng,
            startDate: row.start_date || '',
            endDate: row.end_date || '',
            totalDays: row.total_days || 0,
            currency: row.currency || 'KRW',
            data: snap.data || {},
            hotels: snap.hotels || {},
            meals: snap.meals || {},
            expenses: snap.expenses || {},
            flights: snap.flights || { outbound: null, return: null },
            dayCities: snap.dayCities || {},
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
