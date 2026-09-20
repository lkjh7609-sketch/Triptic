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
