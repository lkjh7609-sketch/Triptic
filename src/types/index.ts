/**
 * Triptic 핵심 타입 정의
 */

// 기본 위치 정보
export interface LatLng {
    lat: number;
    lng: number;
}

// 장소 정보
export interface Place extends LatLng {
    name: string;
    address?: string;
    time?: string; // HH:MM 형식
    memo?: string;
    mealType?: MealType;
    placeId?: string; // Google Places ID
}

// 식사 타입
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'cafe';

// 숙소 정보
export interface Hotel extends LatLng {
    name: string;
    address?: string;
    placeId?: string;
}

// 항공편 정보
export interface Flight {
    flightNo: string;
    airline?: string;
    dep: {
        iata?: string;
        name?: string;
        time?: string;
    };
    arr: {
        iata?: string;
        name?: string;
        time?: string;
    };
}

// 경비 항목
export interface Expense {
    name: string;
    amount: number;
    category: ExpenseCategory;
    method: PaymentMethod;
}

export type ExpenseCategory = 'food' | 'transport' | 'accommodation' | 'shopping' | 'other';
export type PaymentMethod = 'cash' | 'card';

// 일차별 데이터
export interface DayData {
    places: Place[];
    hotel?: Hotel;
    meals: Record<MealType, Place | null>;
    expenses: Expense[];
}

// 여행 프로젝트
export interface Trip {
    name: string;
    city: string;
    cityLat?: number;
    cityLng?: number;
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
    totalDays: number;
    currency: string;
    data: Record<number, Place[]>; // 일차별 장소 목록
    hotels: Record<number, Hotel>; // 일차별 숙소
    meals: Record<number, Record<MealType, Place | null>>; // 일차별 식사
    expenses: Record<number, Expense[]>; // 일차별 경비
    flights: {
        outbound?: Flight;
        return?: Flight;
    };
    shareId?: string; // Supabase shared_trips.share_code
    supabaseId?: string; // Supabase trips.id (UUID) — 클라우드 동기화 시 연결됨
    currentDay?: number;
    updatedAt?: number;
}

// 모든 프로젝트 컬렉션
export type AllProjects = Record<string, Trip>;

// AI 추천 카테고리
export type RecommendationCategory = 'all' | 'restaurant' | 'cafe' | 'culture' | 'spot';

// AI 추천 결과
export interface Recommendation {
    name: string;
    category: string;
    categoryLabel: string;
    distance: string;
    estimatedRating: number;
    signatureMenu?: string;
    priceRange?: string;
    reason: string;
    tip?: string;
    googlePlace?: any; // Google Places API result
}

// API 응답 타입
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

// 저장소 정보
export interface StorageInfo {
    used: number; // MB
    available: number; // MB
    percentage: number;
}

// 상태 이벤트 타입
export type StateEvent =
    | 'dayChanged'
    | 'projectChanged'
    | 'modeChanged'
    | 'tripInfoChanged'
    | 'plannerDataChanged'
    | 'hotelDataChanged'
    | 'flightDataChanged'
    | 'projectAdded'
    | 'projectDeleted'
    | 'stateReset';

// 이벤트 리스너
export type StateListener<T = any> = (data: T) => void;

// 토스트 옵션
export interface ToastOptions {
    type?: 'info' | 'success' | 'warning' | 'error';
    duration?: number;
}

// Google Maps 타입 (글로벌 선언)
declare global {
    interface Window {
        google: any;
        appState: any;
        showToast: (message: string, options?: ToastOptions) => void;
        SUPABASE_ENABLED: boolean;
        supabaseClient?: any;
    }
}

export {};
