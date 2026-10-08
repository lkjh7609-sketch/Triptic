/** 같이 다닌 친구 — 다녀온 여행들의 멤버 중 나를 뺀 사람들, 함께한 횟수 순 */
export interface FriendMember {
  userId: string;
  name: string | null;
}

export interface Friend {
  userId: string;
  name: string | null;
  trips: number;
}

export function computeFriends(
  tripIds: string[],
  membersByTrip: Record<string, FriendMember[]> | undefined,
  myId: string | null,
): Friend[] {
  const map = new Map<string, Friend>();
  for (const id of tripIds) {
    const seenInTrip = new Set<string>();
    for (const m of membersByTrip?.[id] ?? []) {
      if (m.userId === myId || seenInTrip.has(m.userId)) continue;
      seenInTrip.add(m.userId);
      const cur = map.get(m.userId) ?? { userId: m.userId, name: m.name, trips: 0 };
      cur.trips += 1;
      cur.name = cur.name ?? m.name;
      map.set(m.userId, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.trips - a.trips || (a.name ?? '').localeCompare(b.name ?? ''));
}
