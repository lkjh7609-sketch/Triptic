import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/api/supabaseClient';
import { takePrefetch } from '@/shared/api/prefetch';
import type { ParkingLot } from './parkingParse';

export interface AirportParkingData {
  lots: ParkingLot[];
  /** 출처별로 외부에서 마지막으로 받은 시각(ISO) */
  fetchedAt: { kac: string | null; icn: string | null };
  /** 출처별로 한동안 못 받아 마지막 값을 보여 주는 중 */
  stale: { kac: boolean; icn: boolean };
}

/** 화면이 서버에 다시 묻는 간격 — 서버도 이 간격 안에서는 외부 API를 다시 부르지 않는다(supabase/functions/airport-parking) */
export const PARKING_REFRESH_MS = 2 * 60 * 1000;

export async function fetchAirportParking(): Promise<AirportParkingData> {
  // 공항 화면 첫 진입에서는 index.html이 이 요청을 이미 시작해 뒀다(shared/api/prefetch.ts)
  let data = await takePrefetch<unknown>('airport-parking');
  if (!data) {
    const result = await getSupabaseClient().functions.invoke('airport-parking', { body: {} });
    if (result.error) throw result.error;
    data = result.data;
  }
  const d = data as Partial<AirportParkingData> | null;
  if (!d || !Array.isArray(d.lots)) throw new Error('airport-parking: unexpected response');
  return {
    lots: d.lots,
    fetchedAt: { kac: d.fetchedAt?.kac ?? null, icn: d.fetchedAt?.icn ?? null },
    stale: { kac: !!d.stale?.kac, icn: !!d.stale?.icn },
  };
}

/** 공항 주차장 남은 대수·혼잡도 — 2분마다 다시 받는다. 실패하면 직전 값을 그대로 둔다(react-query 기본 동작) */
export function useAirportParking() {
  return useQuery({
    queryKey: ['airport', 'parking'],
    queryFn: fetchAirportParking,
    staleTime: PARKING_REFRESH_MS,
    refetchInterval: PARKING_REFRESH_MS,
    refetchIntervalInBackground: false,
    retry: 1,
  });
}
