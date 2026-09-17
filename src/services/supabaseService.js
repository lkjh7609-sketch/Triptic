/**
 * Supabase 데이터베이스 서비스
 * localStorage를 대체하여 클라우드 동기화 지원
 */

import { StorageService } from './storageService.js';

export class SupabaseService {
    constructor() {
        this.supabase = null;
        this.initialized = false;
    }

    /**
     * Supabase 클라이언트 초기화
     * @param {string} supabaseUrl - Supabase 프로젝트 URL
     * @param {string} supabaseKey - Supabase anon key
     */
    async initialize(supabaseUrl, supabaseKey) {
        if (this.initialized) return;

        try {
            // Supabase 클라이언트 로드 (CDN)
            if (!window.supabase) {
                await this._loadSupabaseSDK();
            }

            this.supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
            this.initialized = true;
            console.log('Supabase 초기화 완료');
        } catch (error) {
            console.error('Supabase 초기화 실패:', error);
            throw error;
        }
    }

    /**
     * Supabase SDK 동적 로드
     * @private
     */
    async _loadSupabaseSDK() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * 익명 세션 생성 (로그인 없이 사용)
     */
    async createAnonymousSession() {
        if (!this.supabase) throw new Error('Supabase가 초기화되지 않았습니다.');

        const { data, error } = await this.supabase.auth.signInAnonymously();
        if (error) throw error;

        return data.user;
    }

    /**
     * 여행 저장
     * @param {Object} tripData - 여행 데이터
     * @returns {Promise<string>} 여행 ID
     */
    async saveTrip(tripData) {
        if (!this.supabase) throw new Error('Supabase가 초기화되지 않았습니다.');

        const { data: { user } } = await this.supabase.auth.getUser();
        if (!user) throw new Error('인증되지 않은 사용자');

        // 여행 메타 데이터 저장
        const { data: trip, error: tripError } = await this.supabase
            .from('trips')
            .upsert({
                id: tripData.id,
                user_id: user.id,
                name: tripData.name,
                city: tripData.city,
                city_lat: tripData.cityLat,
                city_lng: tripData.cityLng,
                start_date: tripData.startDate,
                end_date: tripData.endDate,
                total_days: tripData.totalDays,
                currency: tripData.currency || 'KRW'
            })
            .select()
            .single();

        if (tripError) throw tripError;

        // 장소 데이터 저장 (일괄 처리)
        if (tripData.data) {
            await this._savePlaces(trip.id, tripData.data);
        }

        // 숙소 데이터 저장
        if (tripData.hotels) {
            await this._saveHotels(trip.id, tripData.hotels);
        }

        // 항공편 저장
        if (tripData.flights) {
            await this._saveFlights(trip.id, tripData.flights);
        }

        // 경비 저장
        if (tripData.expenses) {
            await this._saveExpenses(trip.id, tripData.expenses);
        }

        return trip.id;
    }

    /**
     * 장소 데이터 저장
     * @private
     */
    async _savePlaces(tripId, plannerData) {
        const places = [];

        Object.entries(plannerData).forEach(([day, items]) => {
            if (!Array.isArray(items)) return;

            items.forEach((item, position) => {
                places.push({
                    trip_id: tripId,
                    day: parseInt(day),
                    position,
                    name: item.name,
                    address: item.address,
                    lat: item.lat,
                    lng: item.lng,
                    time: item.time,
                    memo: item.memo,
                    meal_type: item.mealType,
                    place_id: item.placeId
                });
            });
        });

        if (places.length === 0) return;

        // 기존 데이터 삭제 후 새로 삽입
        await this.supabase.from('places').delete().eq('trip_id', tripId);

        const { error } = await this.supabase.from('places').insert(places);
        if (error) throw error;
    }

    /**
     * 숙소 데이터 저장
     * @private
     */
    async _saveHotels(tripId, hotelsData) {
        const hotels = Object.entries(hotelsData).map(([day, hotel]) => ({
            trip_id: tripId,
            day: parseInt(day),
            name: hotel.name,
            address: hotel.address,
            lat: hotel.lat,
            lng: hotel.lng,
            place_id: hotel.placeId
        }));

        if (hotels.length === 0) return;

        await this.supabase.from('hotels').delete().eq('trip_id', tripId);

        const { error } = await this.supabase.from('hotels').insert(hotels);
        if (error) throw error;
    }

    /**
     * 항공편 저장
     * @private
     */
    async _saveFlights(tripId, flightsData) {
        const flights = [];

        if (flightsData.outbound) {
            flights.push({
                trip_id: tripId,
                type: 'outbound',
                flight_no: flightsData.outbound.flightNo,
                airline: flightsData.outbound.airline,
                dep_iata: flightsData.outbound.dep?.iata,
                dep_name: flightsData.outbound.dep?.name,
                dep_time: flightsData.outbound.dep?.time,
                arr_iata: flightsData.outbound.arr?.iata,
                arr_name: flightsData.outbound.arr?.name,
                arr_time: flightsData.outbound.arr?.time
            });
        }

        if (flightsData.return) {
            flights.push({
                trip_id: tripId,
                type: 'return',
                flight_no: flightsData.return.flightNo,
                airline: flightsData.return.airline,
                dep_iata: flightsData.return.dep?.iata,
                dep_name: flightsData.return.dep?.name,
                dep_time: flightsData.return.dep?.time,
                arr_iata: flightsData.return.arr?.iata,
                arr_name: flightsData.return.arr?.name,
                arr_time: flightsData.return.arr?.time
            });
        }

        if (flights.length === 0) return;

        await this.supabase.from('flights').delete().eq('trip_id', tripId);

        const { error } = await this.supabase.from('flights').insert(flights);
        if (error) throw error;
    }

    /**
     * 경비 저장
     * @private
     */
    async _saveExpenses(tripId, expensesData) {
        const expenses = [];

        Object.entries(expensesData).forEach(([day, items]) => {
            if (!Array.isArray(items)) return;

            items.forEach(item => {
                expenses.push({
                    trip_id: tripId,
                    day: parseInt(day),
                    item_name: item.name,
                    amount: item.amount,
                    category: item.category,
                    payment_method: item.method
                });
            });
        });

        if (expenses.length === 0) return;

        await this.supabase.from('expenses').delete().eq('trip_id', tripId);

        const { error } = await this.supabase.from('expenses').insert(expenses);
        if (error) throw error;
    }

    /**
     * 여행 불러오기
     * @param {string} tripId - 여행 ID
     * @returns {Promise<Object>} 여행 데이터
     */
    async loadTrip(tripId) {
        if (!this.supabase) throw new Error('Supabase가 초기화되지 않았습니다.');

        // 함수 호출로 전체 데이터 한 번에 조회
        const { data, error } = await this.supabase.rpc('get_trip_full_data', {
            trip_uuid: tripId
        });

        if (error) throw error;

        return this._transformToLocalFormat(data);
    }

    /**
     * 모든 여행 목록 조회
     * @returns {Promise<Array>} 여행 목록
     */
    async listTrips() {
        if (!this.supabase) throw new Error('Supabase가 초기화되지 않았습니다.');

        const { data: { user } } = await this.supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await this.supabase
            .from('trips')
            .select('*')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false });

        if (error) throw error;

        return data;
    }

    /**
     * localStorage에서 Supabase로 마이그레이션
     * @returns {Promise<number>} 마이그레이션된 여행 수
     */
    async migrateFromLocalStorage() {
        const localProjects = StorageService.load();
        const projectNames = Object.keys(localProjects);

        if (projectNames.length === 0) {
            console.log('마이그레이션할 데이터가 없습니다.');
            return 0;
        }

        let migratedCount = 0;

        for (const name of projectNames) {
            try {
                const project = localProjects[name];
                await this.saveTrip({
                    name,
                    ...project
                });
                migratedCount++;
                console.log(`✓ ${name} 마이그레이션 완료`);
            } catch (error) {
                console.error(`✗ ${name} 마이그레이션 실패:`, error);
            }
        }

        return migratedCount;
    }

    /**
     * Supabase 데이터를 localStorage 형식으로 변환
     * @private
     */
    _transformToLocalFormat(supabaseData) {
        const { trip, places, hotels, flights, expenses } = supabaseData;

        // places를 일자별로 그룹화
        const plannerData = {};
        if (places) {
            places.forEach(place => {
                if (!plannerData[place.day]) plannerData[place.day] = [];
                plannerData[place.day].push({
                    name: place.name,
                    address: place.address,
                    lat: place.lat,
                    lng: place.lng,
                    time: place.time,
                    memo: place.memo,
                    mealType: place.meal_type,
                    placeId: place.place_id
                });
            });
        }

        return {
            city: trip.city,
            cityLat: trip.city_lat,
            cityLng: trip.city_lng,
            startDate: trip.start_date,
            endDate: trip.end_date,
            totalDays: trip.total_days,
            currency: trip.currency,
            data: plannerData,
            hotels: hotels || {},
            flights: flights || {},
            expenses: expenses || []
        };
    }
}

// 싱글톤 인스턴스
export const supabaseService = new SupabaseService();

export default SupabaseService;
