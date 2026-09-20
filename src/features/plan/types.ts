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
}

export interface HotelItem {
  name: string;
  address?: string;
  lat: number;
  lng: number;
}

export type PlannerData = Record<number, PlaceItem[]>;
export type HotelsData = Record<number, HotelItem>;
