import { useEffect, useRef, useState } from 'react';
import { fetchFlights, KayakUnavailableError, type FlightSort, type KayakFlightQuery, type KayakFlightsResponse } from './kayakApi';

export interface FlightResultsState {
  data: KayakFlightsResponse | null;
  /** 아직 더 모이는 중(첫 결과가 왔어도 true일 수 있다) */
  loading: boolean;
  error: 'unavailable' | 'failed' | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const MAX_POLLS = 14;

/**
 * Kayak 항공 검색 — 시작하고 완료될 때까지 1.5초마다 이어 받는다(결과는 오는 대로 보여 준다).
 * 정렬·경유 조건만 바뀌면 같은 searchId로 이어 받아 새로 검색하지 않는다.
 */
export function useFlightResults(search: Omit<KayakFlightQuery, 'sort' | 'stops'> | null, sort: FlightSort, stops: number | null): FlightResultsState {
  const [state, setState] = useState<FlightResultsState>({ data: null, loading: false, error: null });
  const cont = useRef<{ key: string; searchId: string; cluster: string } | null>(null);
  const key = search ? JSON.stringify(search) : '';

  useEffect(() => {
    if (!search) return;
    const ac = new AbortController();
    let live = true;
    const run = async () => {
      let c = cont.current && cont.current.key === key ? cont.current : null;
      if (!c) cont.current = null;
      setState((s) => ({ data: cont.current ? s.data : null, loading: true, error: null }));
      try {
        for (let i = 0; i < MAX_POLLS; i++) {
          const r = await fetchFlights({ ...search, sort, stops }, c, ac.signal);
          if (!live) return;
          if (r.searchId && r.cluster) {
            c = { key, searchId: r.searchId, cluster: r.cluster };
            cont.current = c;
          }
          setState({ data: r, loading: r.status !== 'complete', error: null });
          if (r.status === 'complete') return;
          await sleep(1500);
          if (!live) return;
        }
        setState((s) => ({ ...s, loading: false }));
      } catch (e) {
        if (!live || ac.signal.aborted) return;
        setState({ data: null, loading: false, error: e instanceof KayakUnavailableError ? 'unavailable' : 'failed' });
      }
    };
    void run();
    return () => {
      live = false;
      ac.abort();
    };
    // search는 key로 비교한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, sort, stops]);

  return search ? state : { data: null, loading: false, error: null };
}
