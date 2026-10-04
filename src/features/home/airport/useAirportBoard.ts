import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { takePrefetch } from '@/shared/api/prefetch';
import { getSupabaseClient } from '@/shared/api/supabaseClient';
import { kstNow, type BoardFlight } from './boardParse';

export interface AirportBoardData {
  departures: BoardFlight[];
  arrivals: BoardFlight[];
  /** 외부에서 마지막으로 받은 시각(ISO) — 아직 한 번도 못 받았으면 null */
  fetchedAt: string | null;
  /** 이번 갱신이 일부(또는 전부) 실패했거나 권한을 못 받아 마지막 값을 그대로 보여 주는 중 */
  stale: boolean;
}

/** 화면이 서버에 다시 묻는 간격 — 서버도 이 간격 안에서는 외부 API를 다시 부르지 않는다(하루 1,000회 제한) */
export const BOARD_REFRESH_MS = 3 * 60 * 1000;

export const airportBoardQueryKey = ['airport', 'incheon'] as const;

const isFlights = (v: unknown): v is BoardFlight[] => Array.isArray(v);

export async function fetchAirportBoard(): Promise<AirportBoardData> {
  // 홈 첫 화면에서는 index.html이 이 요청을 이미 시작해 뒀다(shared/api/prefetch.ts)
  let data = await takePrefetch<unknown>('incheon-board');
  if (!data) {
    const result = await getSupabaseClient().functions.invoke('incheon-board', { body: {} });
    if (result.error) throw result.error;
    data = result.data;
  }
  const board = data as Partial<AirportBoardData> | null;
  if (!board || !isFlights(board.departures) || !isFlights(board.arrivals))
    throw new Error('incheon-board: unexpected response');
  return {
    departures: board.departures,
    arrivals: board.arrivals,
    fetchedAt: board.fetchedAt ?? null,
    stale: !!board.stale,
  };
}

/** 인천공항 출·도착 전광판 — 3분마다 다시 받는다. 실패하면 직전 값을 그대로 둔다(react-query 기본 동작) */
export function useAirportBoard() {
  return useQuery({
    queryKey: airportBoardQueryKey,
    queryFn: fetchAirportBoard,
    staleTime: BOARD_REFRESH_MS,
    refetchInterval: BOARD_REFRESH_MS,
    refetchIntervalInBackground: false,
    retry: 1,
  });
}

/** 지금 시각(ms) — 1분마다 갱신. 렌더 중에 Date.now()를 직접 부르지 않기 위한 것 */
export function useNowMs(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/** 한국 시각의 지금(분) — 1분마다 다시 계산해 '몇 분 전 출발한 편은 뺀다' 같은 표시가 서버 응답 사이에도 따라온다 */
export function useKstMinutes(): number {
  const [minutes, setMinutes] = useState(() => kstNow().minutes);
  useEffect(() => {
    const id = window.setInterval(() => setMinutes(kstNow().minutes), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return minutes;
}
