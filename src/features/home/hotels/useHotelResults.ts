import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchHotels, KayakUnavailableError, type HotelQuery, type KayakHotel, type KayakHotelsResponse } from '@/features/kayak/kayakApi';

export interface HotelResultsState {
  hotels: KayakHotel[];
  total: number;
  hasMore: boolean;
  currency: string;
  sandbox: boolean;
  /** 필터 목록(별·편의시설·가격대) — 필터를 걸기 전 결과 기준으로 고정해 둔다(걸 때마다 선택지가 줄어들지 않게) */
  facets: KayakHotelsResponse['filters'] | null;
  loading: boolean;
  loadingMore: boolean;
  error: 'unavailable' | 'failed' | null;
}

const EMPTY: HotelResultsState = { hotels: [], total: 0, hasMore: false, currency: 'USD', sandbox: false, facets: null, loading: false, loadingMore: false, error: null };

const isFiltered = (q: HotelQuery) => q.stars.length > 0 || q.guestRating !== null || q.minPrice !== null || q.maxPrice !== null || q.propertyTypes.length > 0 || q.facilities.length > 0;

/**
 * Kayak 호텔 검색 — 조건이 바뀌면 처음부터, "더 보기"는 다음 쪽을 이어 붙인다.
 * 결과가 크고 사용자별이라 쿼리 캐시(기기 저장)에 넣지 않고 화면 안에서만 들고 있는다.
 */
export function useHotelResults(query: HotelQuery | null): HotelResultsState & { loadMore: () => void } {
  const [state, setState] = useState<HotelResultsState>(EMPTY);
  const pageRef = useRef(0);
  const acRef = useRef<AbortController | null>(null);
  const queryRef = useRef(query);
  const facetsKey = useRef('');
  const key = query ? JSON.stringify(query) : '';

  useEffect(() => {
    queryRef.current = query;
    acRef.current?.abort();
    if (!query) return;
    const ac = new AbortController();
    acRef.current = ac;
    pageRef.current = 0;
    // 검색 대상(목적지·날짜·인원)이 바뀌면 필터 목록도 새로, 필터만 바뀌면 그대로
    const base = JSON.stringify({ d: query.destination, i: query.checkin, o: query.checkout, a: query.adults, r: query.rooms, c: query.childAges, cur: query.currency });
    const resetFacets = facetsKey.current !== base;
    facetsKey.current = base;
    setState((s) => ({ ...EMPTY, facets: resetFacets ? null : s.facets, loading: true }));
    fetchHotels(query, 0, ac.signal)
      .then((r) =>
        setState((s) => ({
          ...EMPTY,
          hotels: r.hotels,
          total: r.total,
          hasMore: r.hasMore,
          currency: r.currency,
          sandbox: r.sandbox,
          facets: s.facets && !resetFacets ? s.facets : isFiltered(query) ? s.facets : r.filters,
        })),
      )
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        setState((s) => ({ ...EMPTY, facets: s.facets, error: e instanceof KayakUnavailableError ? 'unavailable' : 'failed' }));
      });
    return () => ac.abort();
    // query는 key로 비교한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const loadMore = useCallback(() => {
    const q = queryRef.current;
    const ac = acRef.current;
    if (!q || !ac || ac.signal.aborted) return;
    const next = pageRef.current + 1;
    setState((s) => (s.loadingMore || !s.hasMore ? s : { ...s, loadingMore: true }));
    fetchHotels(q, next, ac.signal)
      .then((r) => {
        pageRef.current = next;
        setState((s) => {
          const seen = new Set(s.hotels.map((h) => h.id));
          return { ...s, hotels: [...s.hotels, ...r.hotels.filter((h) => !seen.has(h.id))], hasMore: r.hasMore, loadingMore: false };
        });
      })
      .catch(() => {
        if (!ac.signal.aborted) setState((s) => ({ ...s, loadingMore: false }));
      });
  }, []);

  return { ...(query ? state : EMPTY), loadMore };
}
