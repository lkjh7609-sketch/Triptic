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
}

export interface HotelItem {
  name: string;
  address?: string;
  lat: number;
  lng: number;
}

export type PlannerData = Record<number, PlaceItem[]>;
export type HotelsData = Record<number, HotelItem>;
