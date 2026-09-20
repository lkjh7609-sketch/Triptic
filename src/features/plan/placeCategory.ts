/**
 * Google Places `types` → 카테고리 자동 추론 (02-screens.md §3.4)
 * "카테고리 자동 추론 (Places types → 관광/식당/카페/쇼핑/숙소/교통)"
 */
export type PlaceCategory = 'sight' | 'restaurant' | 'cafe' | 'shopping' | 'lodging' | 'transport' | 'other';

const CATEGORY_MAP: Array<[string[], PlaceCategory]> = [
  [['lodging'], 'lodging'],
  [['cafe', 'bakery'], 'cafe'],
  [['restaurant', 'meal_takeaway', 'meal_delivery', 'food'], 'restaurant'],
  [
    ['shopping_mall', 'store', 'clothing_store', 'department_store', 'supermarket', 'convenience_store'],
    'shopping',
  ],
  [
    ['transit_station', 'subway_station', 'train_station', 'bus_station', 'airport', 'taxi_stand'],
    'transport',
  ],
  [['tourist_attraction', 'museum', 'park', 'amusement_park', 'zoo', 'art_gallery'], 'sight'],
];
// point_of_interest / establishment는 의도적으로 제외한다 — Google Places가
// 거의 모든 장소(카페·식당 포함)에 함께 부여하는 범용 태그라 특정 카테고리로
// 단정지으면 오분류가 잦다. 위 목록에 걸리지 않으면 'other'로 남긴다.

export const CATEGORY_LABEL: Record<PlaceCategory, string> = {
  sight: '관광',
  restaurant: '식당',
  cafe: '카페',
  shopping: '쇼핑',
  lodging: '숙소',
  transport: '교통',
  other: '기타',
};

/** Google Places 결과의 types 배열에서 카테고리를 추론한다. 일치하는 것이 없으면 'other' */
export function inferPlaceCategory(placeTypes: string[] | undefined | null): PlaceCategory {
  if (!placeTypes || placeTypes.length === 0) return 'other';
  for (const [types, category] of CATEGORY_MAP) {
    if (placeTypes.some((t) => types.includes(t))) return category;
  }
  return 'other';
}
