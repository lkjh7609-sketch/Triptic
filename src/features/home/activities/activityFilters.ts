/**
 * 액티비티 탭(마이리얼트립) 필터·정렬. 서버(마이리얼트립 검색 API)가 걸어 주는 것과 받은 결과에서 거르는 것이 나뉜다:
 *  - 서버: 카테고리(도시마다 다른 값) · 최대 가격 · 정렬 · "한국어 가이드"(검색어에 붙여 근사)
 *  - 받은 결과에서: 최소 평점 · 즉시 확정(상품 tags)
 * "할인 특가"(원가 필드 없음)는 API로 만들 수 없어 넣지 않았다.
 */

export const PRICE_MAX = 350_000;
export const PRICE_STEP = 10_000;

export const MIN_RATINGS = [0, 4.5, 4.8, 4.9] as const;
export type MinRating = (typeof MIN_RATINGS)[number];

export const SORTS = ['recommended', 'popular', 'priceAsc', 'priceDesc', 'rating'] as const;
export type ActivitySort = (typeof SORTS)[number];

/** 마이리얼트립 검색 정렬 값(api/_lib/affiliates/myrealtrip.js TNA_SORTS). 추천순은 정렬을 보내지 않는 기본 동작 */
const SERVER_SORT: Record<ActivitySort, string | undefined> = {
  recommended: undefined,
  popular: 'selling_count_desc',
  priceAsc: 'price_asc',
  priceDesc: 'price_desc',
  rating: 'review_score_desc',
};

export interface ActivityFilters {
  /** 도시별 카테고리 값(마이리얼트립이 준 것). null=전체 */
  category: string | null;
  /** 1인 최대 가격(원). PRICE_MAX면 제한 없음 */
  maxPrice: number;
  minRating: MinRating;
  instant: boolean;
  koreanGuide: boolean;
}

export const DEFAULT_FILTERS: ActivityFilters = { category: null, maxPrice: PRICE_MAX, minRating: 0, instant: false, koreanGuide: false };

/** 기본값이 아닌 필터 종류의 수(필터 버튼 배지). 정렬은 세지 않는다 */
export function countActiveFilters(f: ActivityFilters): number {
  return (
    (f.category ? 1 : 0) +
    (f.maxPrice < PRICE_MAX ? 1 : 0) +
    (f.minRating > 0 ? 1 : 0) +
    (f.instant || f.koreanGuide ? 1 : 0)
  );
}

/** 받은 결과에서 거르는 필터가 켜져 있는가(켜져 있으면 총 개수를 정확히 알 수 없다) */
export function hasClientFilter(f: ActivityFilters): boolean {
  return f.minRating > 0 || f.instant;
}

export function serverSort(sort: ActivitySort): string | undefined {
  return SERVER_SORT[sort];
}

export function serverMaxPrice(f: ActivityFilters): number | undefined {
  return f.maxPrice < PRICE_MAX ? f.maxPrice : undefined;
}

/** "한국어 가이드"는 API 필드가 없어 검색어에 "한국어"를 붙여 근사한다 */
export function searchKeyword(city: string, f: ActivityFilters): string {
  return f.koreanGuide ? `${city} 한국어` : city; // i18n-exempt: 마이리얼트립 검색어
}

export const INSTANT_TAG = '즉시 확정'; // i18n-exempt: 마이리얼트립이 상품 tags로 주는 값

interface Filterable {
  rating: number | null;
  tags: string[];
}

export function applyClientFilters<T extends Filterable>(items: readonly T[], f: ActivityFilters): T[] {
  return items.filter((item) => {
    if (f.minRating > 0 && (item.rating ?? 0) < f.minRating) return false;
    if (f.instant && !item.tags.includes(INSTANT_TAG)) return false;
    return true;
  });
}
