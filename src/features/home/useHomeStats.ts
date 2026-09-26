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
  companionCount?: number;
}

/**
 * 통계 RPC + 동행자 수. 동행자 = 내가 접근할 수 있는 여행(RLS: can_access_trip)의
 * 멤버 중 나를 뺀 서로 다른 사람 수. 사용자 id는 세션에서 받는다(auth.getUser()는
 * 매번 Auth 서버 왕복이라 쓰지 않는다).
 */
async function fetchHomeStats(userId: string): Promise<TravelStats> {
  const supabase = getSupabaseClient();
  const [statsRes, membersRes] = await Promise.all([
    supabase.rpc('get_user_travel_stats'),
    supabase.from('trip_members').select('user_id').neq('user_id', userId),
  ]);

  if (statsRes.error) throw statsRes.error;
  const stats = statsRes.data as TravelStats;
  const companionCount = membersRes.error
    ? 0
    : new Set((membersRes.data ?? []).map((m) => m.user_id as string)).size;

  return { ...stats, companionCount };
}

export function useHomeStats() {
  const { user } = useSession();
  return useQuery({
    queryKey: ['homeStats', user?.id ?? null],
    queryFn: () => fetchHomeStats(user!.id),
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // §2.2 "결과를 5분 캐시한다"
  });
}
