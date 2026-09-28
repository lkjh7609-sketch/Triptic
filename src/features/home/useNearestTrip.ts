import { useMemo } from 'react';
import { format } from 'date-fns';
import { useTrips } from '@/features/plan/hooks/useTrips';

/** 가장 가까운(진행 중이거나 곧 떠나는) 내 여행 — 좌표가 있는 것만 */
export function useNearestTrip() {
  const { data: trips } = useTrips();
  return useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return (trips ?? [])
      .filter((trip) => trip.city_lat != null && trip.city_lng != null && (trip.end_date ?? trip.start_date ?? '') >= today)
      .sort((a, b) => (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999'))[0];
  }, [trips]);
}
