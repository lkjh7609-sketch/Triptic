/**
 * 홈 대시보드 통계 (02-screens.md §2.2)
 * get_user_travel_stats() RPC(03-data-model.md §5, supabase/migrations/0009) 호출.
 * ADR-002 정규화 이관(M2/M5, sync-trip-normalized Edge Function)으로
 * itinerary_items/trip_days/legs가 항상 최신 상태로 동기화되므로, 임시였던
 * snapshot 기반 0014 RPC 대신 스펙 원본 RPC를 그대로 쓴다.
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
  /** legs.mode<>'flight' 구간의 haversine 추정 거리 합 — 값이 없으면(구간이
   * 아예 없는 완료 여행) 0으로 돌아온다(§5 coalesce), null이 아니다 */
  groundMeters: number | null;
  countries: string[];
}

async function fetchHomeStats(): Promise<TravelStats> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('get_user_travel_stats');
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
