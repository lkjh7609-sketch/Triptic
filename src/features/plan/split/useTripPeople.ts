import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/api/supabaseClient';
import { useTripMembers } from '../hooks/useTripMembers';
import type { Person } from './splitModel';

interface ProfileRow {
  id: string;
  display_name: string | null;
  pixel_avatar_seed: string | null;
}

export interface TripPeople {
  /** 지금 여행 멤버(나 → 만든 사람 → 나머지 이름순). 선택 칸에 보이는 사람들 */
  members: Person[];
  /** id로 사람 찾기 — 나간 일행이나 지워진 계정도 빈 이름의 '나간 일행'으로 돌려준다 */
  byId: (id: string) => Person;
  loading: boolean;
}

/**
 * 더치페이 화면이 쓰는 사람 목록. 멤버는 useTripMembers(trip_members + 공개 프로필)를 그대로 쓰고,
 * 이미 나간 사람이 낸·나눈 기록에 남아 있으면 그 id의 공개 프로필을 따로 읽어 이름과 캐릭터를 보여 준다.
 * (프로필까지 없으면 이름 없는 '나간 일행' — 계정을 지운 사람)
 */
export function useTripPeople(tripId: string | undefined, ownerId: string | null, meId: string | null, extraIds: string[]): TripPeople {
  const { data: byTrip, isLoading } = useTripMembers(tripId ? [tripId] : []);
  const rows = tripId ? byTrip?.[tripId] : undefined;

  const memberIds = useMemo(() => {
    const ids = new Set((rows ?? []).map((m) => m.userId));
    if (ownerId) ids.add(ownerId);
    return ids;
  }, [rows, ownerId]);

  // 멤버 목록에 없는 id(나간 일행) + 멤버 목록에 아직 안 들어온 만든 사람의 프로필
  const lookupIds = useMemo(() => {
    const ids = new Set<string>();
    for (const id of extraIds) if (!(rows ?? []).some((m) => m.userId === id)) ids.add(id);
    if (ownerId && !(rows ?? []).some((m) => m.userId === ownerId)) ids.add(ownerId);
    return [...ids].sort();
  }, [extraIds, rows, ownerId]);

  const { data: extraProfiles } = useQuery({
    queryKey: ['trip-people-extra', lookupIds],
    enabled: lookupIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await getSupabaseClient()
        .from('community_profiles')
        .select('id, display_name, pixel_avatar_seed')
        .in('id', lookupIds);
      return new Map(((data ?? []) as ProfileRow[]).map((p) => [p.id, p]));
    },
  });

  return useMemo(() => {
    const people = new Map<string, Person>();
    for (const m of rows ?? []) {
      people.set(m.userId, { id: m.userId, name: m.name, seed: m.pixelSeed || m.userId, left: false });
    }
    for (const id of lookupIds) {
      const p = extraProfiles?.get(id);
      people.set(id, { id, name: p?.display_name ?? null, seed: p?.pixel_avatar_seed || id, left: id !== ownerId });
    }
    const members = [...people.values()]
      .filter((p) => memberIds.has(p.id))
      .sort((a, b) => rank(a, meId, ownerId) - rank(b, meId, ownerId) || (a.name ?? '').localeCompare(b.name ?? ''));
    const byId = (id: string): Person => people.get(id) ?? { id, name: null, seed: id, left: id !== ownerId && !memberIds.has(id) };
    return { members, byId, loading: isLoading };
  }, [rows, lookupIds, extraProfiles, memberIds, meId, ownerId, isLoading]);
}

function rank(p: Person, meId: string | null, ownerId: string | null): number {
  if (p.id === meId) return 0;
  if (p.id === ownerId) return 1;
  return 2;
}
