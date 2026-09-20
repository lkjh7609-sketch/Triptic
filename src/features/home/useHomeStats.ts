/**
 * 홈 대시보드 통계 (02-screens.md §2.2)
 * get_user_travel_stats_snapshot() RPC(supabase/migrations/0014) 호출 —
 * 정규화 이관(M2~M4) 완료 전까지 trips.snapshot 기반으로 같은 모양의 통계를
 * 낸다. 이관 후에는 이 훅의 rpc 이름만 get_user_travel_stats로 바꾸면 된다.
 */
import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/api/supabaseClient';
import { useSession } from '@/shared/hooks/useSession';

export interface TravelStats {
  tripCount: number;
  countryCount: number;
  cityCount: number;
  dayCount: number;
  placeCount: number;
  /** 스냅샷 스키마에는 구간 거리가 없어 항상 null — 정규화 이관 후 채워진다 */
  groundMeters: number | null;
  countries: string[];
}

async function fetchHomeStats(): Promise<TravelStats> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('get_user_travel_stats_snapshot');
  if (error) throw error;
  return data as TravelStats;
}

export function useHomeStats() {
  const { user } = useSession();
  return useQuery({
    queryKey: ['homeStats', user?.id ?? null],
    queryFn: fetchHomeStats,
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // §2.2 "결과를 5분 캐시한다"
  });
}
