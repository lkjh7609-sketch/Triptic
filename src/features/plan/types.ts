import type { PlaceCategory } from './placeCategory.ts';

/** trips.snapshot.data[day]의 항목 (index.html plannerData와 동일한 형태 — ADR-001) */
export interface PlaceItem {
  name: string;
  address?: string;
  lat: number;
  lng: number;
  placeId?: string | null;
  time?: string;
  memo?: string;
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'cafe';
  /** Places types에서 추론 (02-screens.md §3.4) — 원본 legacy 데이터에는 없을 수 있다 */
  category?: PlaceCategory;
  /**
   * 드래그 순서 변경(dnd-kit)용 안정적 키. 원본 legacy 데이터는 배열 인덱스로만
   * 식별했지만(03-data-model.md §6.2 "기존 항목에는 id가 없다"), dnd-kit는
   * 재정렬 중 안정적인 id가 필요해 3.0에서 새로 추가한 항목부터 부여한다.
   * 레거시로 만들어진 기존 항목엔 없을 수 있어 렌더링 시 index로 폴백한다.
   */
  key?: string;
}

export interface HotelItem {
  name: string;
  address?: string;
  lat: number;
  lng: number;
}

export type PlannerData = Record<number, PlaceItem[]>;
export type HotelsData = Record<number, HotelItem>;

export type MealSlot = 'breakfast' | 'lunch' | 'dinner';

/** 식사 슬롯 1건 (index.html mealsData[day][slot] 이식 — ADR-001) */
export interface MealSlotInfo {
  skip: boolean;
  name?: string;
  address?: string;
  lat?: number;
  lng?: number;
}

export type DayMeals = Partial<Record<MealSlot, MealSlotInfo>>;
export type MealsData = Record<number, DayMeals>;

/** 가계부 카테고리 (02-screens.md §3.7, 0005_expenses.sql category check와 동일) */
export type ExpenseCategory = 'food' | 'transport' | 'lodging' | 'shopping' | 'activity' | 'other';

/** 결제수단 (0005_expenses.sql payment_method check와 동일) */
export type ExpensePaymentMethod = 'cash' | 'card' | 'other';

/**
 * 경비 항목 (index.html expensesData[day] 이식 + 02-screens.md §3.7 확장:
 * 카테고리·통화·결제수단·환율 자동 변환).
 * `currency`/`category`가 없는 기존 데이터는 각각 여행 기본 통화·'other'로
 * 간주한다(하위호환, expenses.ts convertToBase 참고).
 */
export interface ExpenseItem {
  desc: string;
  amount: number;
  currency?: string;
  category?: ExpenseCategory;
  paymentMethod?: ExpensePaymentMethod;
  /**
   * currency가 여행 기본 통화와 다를 때만 의미 있는, 입력 시점 환율
   * 스냅샷(1 currency = fxRateToBase 기본통화). 조회 실패 시 null —
   * 이후 환율이 바뀌어도 이 값은 절대 재계산하지 않는다(스펙 원문 요구사항).
   */
  fxRateToBase?: number | null;
}

export type ExpensesData = Record<number, ExpenseItem[]>;

/** 일차별 다른 도시 설정 (index.html dayCities[day] 이식) */
export interface DayCityInfo {
  name: string;
  lat: number | null;
  lng: number | null;
}

export type DayCitiesData = Record<number, DayCityInfo>;

/** 항공편 도착/출발 지점 (index.html lookupFlight 이식) */
export interface FlightAirportInfo {
  iata: string;
  name: string;
  lat: number | null;
  lng: number | null;
  time: string;
}

/** 항공편 1건 (index.html flightsData.outbound/return 이식) */
export interface FlightInfo {
  flightNo: string;
  date: string;
  airline?: string;
  /** 자동 조회 실패 후 수동 입력한 경우 true (index.html saveManualFlight) */
  manual?: boolean;
  dep: FlightAirportInfo;
  arr: FlightAirportInfo;
}

export interface FlightsData {
  outbound: FlightInfo | null;
  return: FlightInfo | null;
}
