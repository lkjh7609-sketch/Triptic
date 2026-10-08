import { useEffect, useState } from 'react';
import type { FlightSearch } from '@/features/plan/partnerLinks';
import { fetchFlights, FlightsUnavailableError, type FlightsResponse } from './flightsApi';

export interface FlightResultsState {
  data: FlightsResponse | null;
  loading: boolean;
  error: 'unavailable' | 'failed' | null;
  /** 못 보여 줄 때의 예약 사이트 검색 링크 */
  fallbackUrl: string | null;
}

const EMPTY: FlightResultsState = { data: null, loading: false, error: null, fallbackUrl: null };

/**
 * 항공 검색 — 검색이 바뀔 때만 한 번 부른다(왕복은 편도 2개를 짝지어 처음에도 5초 안팎). 정렬·필터는 받은 결과 안에서 화면이 한다.
 * 결과가 사용자 조건별이라 쿼리 캐시(기기 저장)에 넣지 않고 화면 안에서만 들고 있는다.
 */
export function useFlightResults(search: FlightSearch | null, language: string): FlightResultsState {
  const [state, setState] = useState<FlightResultsState>(EMPTY);
  const key = search ? `${JSON.stringify(search)}|${language}` : '';

  useEffect(() => {
    if (!search) return;
    const ac = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ ...EMPTY, loading: true });
    fetchFlights(search, language, ac.signal)
      .then((data) => setState({ ...EMPTY, data }))
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        if (e instanceof FlightsUnavailableError) setState({ ...EMPTY, error: 'unavailable', fallbackUrl: e.bookingUrl });
        else setState({ ...EMPTY, error: 'failed' });
      });
    return () => ac.abort();
    // search·language는 key로 비교한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return search ? state : EMPTY;
}
