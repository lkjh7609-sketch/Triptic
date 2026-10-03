import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { buildCountryAlerts, type CountryAlert } from './alertInfo';
import { listDestinationCoords, listTravelAlerts } from './travelAlertService';

const HOUR_MS = 60 * 60 * 1000;

/** 나라 코드 → 현재 여행경보. 불러오지 못하면(오프라인 등) 빈 표 — 경보 안내는 조용히 빠진다 */
export function useTravelAlerts(): { alerts: Map<string, CountryAlert>; ready: boolean } {
  const { data } = useQuery({
    queryKey: ['travel-alerts'],
    queryFn: listTravelAlerts,
    staleTime: HOUR_MS,
    retry: 1,
  });
  const alerts = useMemo(() => buildCountryAlerts(data ?? []), [data]);
  return { alerts, ready: data !== undefined };
}

export function useDestinationCoords() {
  return useQuery({
    queryKey: ['travel-alerts', 'destination-coords'],
    queryFn: listDestinationCoords,
    staleTime: 24 * HOUR_MS,
    retry: 1,
  });
}
