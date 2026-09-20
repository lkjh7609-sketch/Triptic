import type { PlaceCategory } from './placeCategory';

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

/** 경비 항목 (index.html expensesData[day] 이식) */
export interface ExpenseItem {
  desc: string;
  amount: number;
}

export type ExpensesData = Record<number, ExpenseItem[]>;

/** 일차별 다른 도시 설정 (index.html dayCities[day] 이식) */
export interface DayCityInfo {
  city: string;
  cityLat?: number | null;
  cityLng?: number | null;
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
