import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/api/supabaseClient';
import type { BoardFlight } from './boardParse';
import { BOARD_REFRESH_MS } from './useAirportBoard';

export interface KacBoardData {
  /** 공항 IATA → 출발·도착 */
  boards: Record<string, { departures: BoardFlight[]; arrivals: BoardFlight[] }>;
  fetchedAt: string | null;
  stale: boolean;
}

export async function fetchKacBoard(): Promise<KacBoardData> {
  const { data, error } = await getSupabaseClient().functions.invoke('kac-board', { body: {} });
  if (error) throw error;
  const d = data as Partial<KacBoardData> | null;
  if (!d || !d.boards || typeof d.boards !== 'object') throw new Error('kac-board: unexpected response');
  return { boards: d.boards, fetchedAt: d.fetchedAt ?? null, stale: !!d.stale };
}

/** 김포·대구·김해·제주 등 한국공항공사 공항의 출·도착(13개 공항을 한 번에) — 인천 전광판과 같이 3분마다. enabled=false면 받지 않는다 */
export function useKacBoard(enabled = true) {
  return useQuery({
    queryKey: ['airport', 'kac'],
    queryFn: fetchKacBoard,
    enabled,
    staleTime: BOARD_REFRESH_MS,
    refetchInterval: enabled ? BOARD_REFRESH_MS : false,
    refetchIntervalInBackground: false,
    retry: 1,
  });
}
