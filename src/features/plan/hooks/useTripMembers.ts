import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/api/supabaseClient';

export interface TripMember {
  userId: string;
  role: string;
  name: string | null;
  avatarUrl: string | null;
}

/** 여러 여행의 동행자(trip_members + 공개 프로필)를 한 번에 가져온다. 결과: tripId → 멤버 목록 */
export function useTripMembers(tripIds: string[]) {
  const ids = [...tripIds].sort();
  return useQuery({
    queryKey: ['trip-members', ids],
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Record<string, TripMember[]>> => {
      const supabase = getSupabaseClient();
      const { data: rows, error } = await supabase
        .from('trip_members')
        .select('trip_id, user_id, role')
        .in('trip_id', ids);
      if (error) throw error;

      const userIds = [...new Set((rows ?? []).map((r) => r.user_id as string))];
      const profiles = new Map<string, { display_name: string | null; avatar_url: string | null }>();
      if (userIds.length > 0) {
        const { data: profileRows } = await supabase
          .from('community_profiles')
          .select('id, display_name, avatar_url')
          .in('id', userIds);
        for (const p of profileRows ?? []) profiles.set(p.id as string, p);
      }

      const byTrip: Record<string, TripMember[]> = {};
      for (const r of rows ?? []) {
        const profile = profiles.get(r.user_id as string);
        (byTrip[r.trip_id as string] ??= []).push({
          userId: r.user_id as string,
          role: r.role as string,
          name: profile?.display_name ?? null,
          avatarUrl: profile?.avatar_url ?? null,
        });
      }
      return byTrip;
    },
  });
}

/** 이름 → 아바타 이니셜(최대 2글자). 한중일 이름은 첫 글자 하나 */
export function initialsOf(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  if (/^[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(trimmed)) return trimmed.slice(0, 1);
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}
