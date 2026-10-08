import { useEffect, useRef, useState } from 'react';
import { fetchHotels, HotelsUnavailableError, type HotelQuery, type HotelsResponse } from './hotelsApi';

/** 필터 선택지의 가격 범위 — 필터를 걸기 전 결과 기준으로 고정해 둔다(걸 때마다 범위가 줄어들지 않게) */
export interface HotelFacets {
  priceMin: number;
  priceMax: number;
}

export interface HotelResultsState {
  data: HotelsResponse | null;
  facets: HotelFacets | null;
  loading: boolean;
  error: 'unavailable' | 'failed' | null;
}

const EMPTY: HotelResultsState = { data: null, facets: null, loading: false, error: null };

const isFiltered = (q: HotelQuery) => q.minStars !== null || q.minReview !== null || q.minPrice !== null || q.maxPrice !== null || q.discountOnly;

function priceRange(r: HotelsResponse): HotelFacets | null {
  if (r.hotels.length === 0) return null;
  const prices = r.hotels.map((h) => h.price);
  return { priceMin: Math.min(...prices), priceMax: Math.max(...prices) };
}

/**
 * 호텔 검색 — 조건이 바뀌면 다시 부른다(필터·정렬은 서버가 처리). 한 번에 최대 30곳이고 다음 쪽은 없다.
 * 결과가 사용자별이라 쿼리 캐시(기기 저장)에 넣지 않고 화면 안에서만 들고 있는다.
 */
export function useHotelResults(query: HotelQuery | null): HotelResultsState {
  const [state, setState] = useState<HotelResultsState>(EMPTY);
  const facetsKey = useRef('');
  const key = query ? JSON.stringify(query) : '';

  useEffect(() => {
    if (!query) return;
    const ac = new AbortController();
    // 검색 대상(목적지·날짜·인원·통화)이 바뀌면 필터 범위도 새로, 필터·정렬만 바뀌면 그대로
    const base = JSON.stringify({ lat: query.lat, lng: query.lng, i: query.checkin, o: query.checkout, a: query.adults, c: query.childAges, cur: query.currency });
    const resetFacets = facetsKey.current !== base;
    facetsKey.current = base;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => ({ ...EMPTY, facets: resetFacets ? null : s.facets, loading: true }));
    fetchHotels(query, ac.signal)
      .then((r) =>
        setState((s) => ({
          data: r,
          loading: false,
          error: null,
          facets: s.facets && !resetFacets ? s.facets : isFiltered(query) ? s.facets : priceRange(r),
        })),
      )
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        setState((s) => ({ ...EMPTY, facets: s.facets, error: e instanceof HotelsUnavailableError ? 'unavailable' : 'failed' }));
      });
    return () => ac.abort();
    // query는 key로 비교한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return query ? state : EMPTY;
}
