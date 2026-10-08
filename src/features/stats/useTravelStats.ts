import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/api/supabaseClient';
import { useSession } from '@/shared/hooks/useSession';
import { useDestinations } from '@/features/community/hooks/useDestinations';
import { useFxRates } from '@/features/plan/useFxRates';
import { getRate } from '@/features/plan/fxRates';
import { buildStats, type CityRef, type RawTrip, type TravelStats } from './statsCompute';

export const travelStatsQueryKey = (userId: string | null) => ['travelStats', userId] as const;

function todayLocal(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** 통계 탭 데이터 — 서버 집계(get_travel_stats, 0104) + 도시 목록(나라 판정) + 환율(원화 환산). 셋이 다 와야 계산한다 */
export function useTravelStats(): { stats: TravelStats | undefined; isLoading: boolean; isError: boolean; refetch: () => void } {
  const { user } = useSession();
  const userId = user?.id ?? null;
  const raw = useQuery({
    queryKey: travelStatsQueryKey(userId),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc('get_travel_stats');
      if (error) throw error;
      return (data ?? []) as RawTrip[];
    },
  });
  const destinations = useDestinations();
  const fx = useFxRates();

  const cities = useMemo<CityRef[] | undefined>(
    () => destinations.data?.map((d) => ({ id: d.id, name: d.name, country_code: d.country_code, lat: d.lat, lng: d.lng })),
    [destinations.data],
  );

  const stats = useMemo(() => {
    if (!raw.data || !cities) return undefined;
    return buildStats({
      trips: raw.data,
      cities,
      krwRate: (currency) => getRate(fx.data, currency, 'KRW'),
      today: todayLocal(),
    });
  }, [raw.data, cities, fx.data]);

  return {
    stats,
    isLoading: raw.isLoading || destinations.isLoading,
    isError: raw.isError,
    refetch: () => void raw.refetch(),
  };
}
