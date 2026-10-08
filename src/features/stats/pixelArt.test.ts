import { describe, expect, it } from 'vitest';
import { avatarGrid, badgeGrid, type BadgeKind } from './pixelArt';
import { computeFriends } from './friends';

describe('avatarGrid', () => {
  it('같은 seed면 언제나 같은 모습, 다른 seed면 달라진다', () => {
    expect(avatarGrid('user-1')).toEqual(avatarGrid('user-1'));
    const seeds = Array.from({ length: 40 }, (_, i) => JSON.stringify(avatarGrid(`user-${i}`)));
    expect(new Set(seeds).size).toBeGreaterThan(30);
  });
  it('16×16이고 가운데에 얼굴(피부색)이 있다', () => {
    const g = avatarGrid('x');
    expect(g).toHaveLength(16);
    expect(g.every((row) => row.length === 16)).toBe(true);
    expect(g[8]![8]).toBeTruthy();
  });
});

describe('badgeGrid', () => {
  const kinds: BadgeKind[] = ['firstTrip', 'firstAbroad', 'firstCompanion', 'oneLap', 'countries3', 'countries5', 'countries10', 'trips5', 'trips10', 'trips20', 'days30', 'days100'];
  it('모든 뱃지가 16×16 그림으로 그려지고, 잠긴 것은 회색 계열이다', () => {
    for (const k of kinds) {
      const on = badgeGrid(k, false);
      const off = badgeGrid(k, true);
      expect(on).toHaveLength(16);
      expect(on.flat().filter(Boolean).length).toBeGreaterThan(100);
      expect(JSON.stringify(on)).not.toEqual(JSON.stringify(off));
      expect(off.flat().filter((c) => c && !['#A8A29E', '#E7E5E4'].includes(c))).toEqual([]);
    }
  });
  it('뱃지마다 모양이 다르다(같은 숫자라도 종류별로)', () => {
    const shapes = kinds.map((k) => JSON.stringify(badgeGrid(k, false)));
    expect(new Set(shapes).size).toBe(kinds.length);
  });
});

describe('computeFriends', () => {
  const members = {
    a: [{ userId: 'me', name: '나' }, { userId: 'f1', name: '김복순' }],
    b: [{ userId: 'me', name: '나' }, { userId: 'f1', name: '김복순' }, { userId: 'f2', name: '이재헌' }],
    c: [{ userId: 'me', name: '나' }],
  };
  it('나를 뺀 같이 다닌 사람을 횟수 순으로', () => {
    expect(computeFriends(['a', 'b', 'c'], members, 'me')).toEqual([
      { userId: 'f1', name: '김복순', trips: 2 },
      { userId: 'f2', name: '이재헌', trips: 1 },
    ]);
  });
  it('혼자 다닌 여행뿐이면 빈 목록', () => {
    expect(computeFriends(['c'], members, 'me')).toEqual([]);
    expect(computeFriends([], undefined, 'me')).toEqual([]);
  });
});
