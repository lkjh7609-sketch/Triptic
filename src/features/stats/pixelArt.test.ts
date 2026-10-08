import { describe, expect, it } from 'vitest';
import { AVATAR_H, AVATAR_W, avatarGrid } from './pixelArt';
import { computeFriends } from './friends';

describe('avatarGrid', () => {
  it('같은 seed면 언제나 같은 모습, 다른 seed면 달라진다', () => {
    expect(avatarGrid('user-1')).toEqual(avatarGrid('user-1'));
    const seeds = Array.from({ length: 40 }, (_, i) => JSON.stringify(avatarGrid(`user-${i}`)));
    expect(new Set(seeds).size).toBeGreaterThan(30);
  });
  it('32×48칸 전신이고 머리·몸·발이 다 있다', () => {
    const g = avatarGrid('x');
    expect(g).toHaveLength(AVATAR_H);
    expect(g.every((row) => row.length === AVATAR_W)).toBe(true);
    const rowsWithPixels = g.map((row) => row.some(Boolean));
    expect(rowsWithPixels.slice(5, 46).every(Boolean)).toBe(true); // 머리 위부터 발끝까지 끊김 없이 이어진다
    expect(g[30]![16]).toBeTruthy(); // 몸통
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
