import { describe, expect, it } from 'vitest';
import { listParams } from './activityApi';
import {
  DEFAULT_FILTERS,
  PRICE_MAX,
  applyClientFilters,
  countActiveFilters,
  hasClientFilter,
  searchKeyword,
  serverMaxPrice,
  serverSort,
} from './activityFilters';

const product = (rating: number | null, tags: string[] = []) => ({ rating, tags });

describe('activityFilters', () => {
  it('기본값이면 켜진 필터가 없다', () => {
    expect(countActiveFilters(DEFAULT_FILTERS)).toBe(0);
    expect(hasClientFilter(DEFAULT_FILTERS)).toBe(false);
  });

  it('배지는 기본값이 아닌 필터 "종류" 수 — 혜택 칩 둘을 켜도 1', () => {
    expect(countActiveFilters({ ...DEFAULT_FILTERS, category: 'tour' })).toBe(1);
    expect(countActiveFilters({ ...DEFAULT_FILTERS, maxPrice: 200_000 })).toBe(1);
    expect(countActiveFilters({ ...DEFAULT_FILTERS, minRating: 4.8 })).toBe(1);
    expect(countActiveFilters({ ...DEFAULT_FILTERS, instant: true, koreanGuide: true })).toBe(1);
    expect(countActiveFilters({ category: 'tour', maxPrice: 200_000, minRating: 4.8, instant: true, koreanGuide: false })).toBe(4);
  });

  it('최대 가격이 끝이면 서버에 보내지 않는다', () => {
    expect(serverMaxPrice(DEFAULT_FILTERS)).toBeUndefined();
    expect(serverMaxPrice({ ...DEFAULT_FILTERS, maxPrice: PRICE_MAX - 10_000 })).toBe(PRICE_MAX - 10_000);
  });

  it('추천순은 정렬을 보내지 않고 나머지는 API 값으로', () => {
    expect(serverSort('recommended')).toBeUndefined();
    expect(serverSort('popular')).toBe('selling_count_desc');
    expect(serverSort('priceAsc')).toBe('price_asc');
    expect(serverSort('priceDesc')).toBe('price_desc');
    expect(serverSort('rating')).toBe('review_score_desc');
  });

  it('한국어 가이드는 검색어에 붙여 근사한다', () => {
    expect(searchKeyword('시드니', DEFAULT_FILTERS)).toBe('시드니');
    expect(searchKeyword('시드니', { ...DEFAULT_FILTERS, koreanGuide: true })).toBe('시드니 한국어 가이드');
  });

  it('받은 결과에서 평점·즉시 확정을 거른다(평점 없는 상품은 평점 필터에서 빠진다)', () => {
    const items = [product(4.95, ['즉시 확정']), product(4.6), product(null, ['즉시 확정']), product(4.85)];
    expect(applyClientFilters(items, DEFAULT_FILTERS)).toHaveLength(4);
    expect(applyClientFilters(items, { ...DEFAULT_FILTERS, minRating: 4.8 })).toEqual([product(4.95, ['즉시 확정']), product(4.85)]);
    expect(applyClientFilters(items, { ...DEFAULT_FILTERS, instant: true })).toHaveLength(2);
    expect(applyClientFilters(items, { ...DEFAULT_FILTERS, minRating: 4.9, instant: true })).toEqual([product(4.95, ['즉시 확정'])]);
  });
});

describe('listParams — 서버가 걸어 주는 필터만 요청에 실린다', () => {
  it('기본값은 도시·쪽 크기·쪽만', () => {
    expect(listParams('시드니', 'recommended', DEFAULT_FILTERS, 1).toString()).toBe(
      'provider=myrealtrip&kind=list&q=%EC%8B%9C%EB%93%9C%EB%8B%88&size=20&page=1',
    );
  });

  it('카테고리·최대 가격·정렬·한국어 가이드, 그리고 평점·즉시 확정은 싣지 않는다', () => {
    const params = listParams(
      '시드니',
      'priceAsc',
      { category: 'tour', maxPrice: 150_000, minRating: 4.9, instant: true, koreanGuide: true },
      3,
    );
    expect(params.get('q')).toBe('시드니 한국어 가이드');
    expect(params.get('category')).toBe('tour');
    expect(params.get('maxPrice')).toBe('150000');
    expect(params.get('sort')).toBe('price_asc');
    expect(params.get('page')).toBe('3');
    expect([...params.keys()].some((k) => /rating|instant/i.test(k))).toBe(false);
  });
});
