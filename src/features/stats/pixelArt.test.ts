import { describe, expect, it } from 'vitest';
import { AVATAR_H, AVATAR_W, avatarGrid, avatarSeedOf, randomAvatarSeed } from './pixelArt';
import { computeFriends } from './friends';

describe('avatarGrid', () => {
  it('같은 seed면 언제나 같은 모습, 다른 seed면 달라진다', () => {
    expect(avatarGrid('user-1')).toEqual(avatarGrid('user-1'));
    const seeds = Array.from({ length: 40 }, (_, i) => JSON.stringify(avatarGrid(`user-${i}`)));
    expect(new Set(seeds).size).toBeGreaterThan(30);
  });
  it('36×52칸 전신이고 머리·몸·발이 다 있다', () => {
    const g = avatarGrid('x');
    expect(g).toHaveLength(AVATAR_H);
    expect(g.every((row) => row.length === AVATAR_W)).toBe(true);
    const rowsWithPixels = g.map((row) => row.some(Boolean));
    expect(rowsWithPixels.slice(3, 50).every(Boolean)).toBe(true); // 머리 위부터 발끝까지 끊김 없이 이어진다
    expect(g[34]![18]).toBeTruthy(); // 몸통
  });
});

describe('avatarSeedOf·randomAvatarSeed', () => {
  it('고른 값이 있으면 그것, 없으면 사용자 ID', () => {
    expect(avatarSeedOf('u1', 'abc')).toBe('abc');
    expect(avatarSeedOf('u1', null)).toBe('u1');
    expect(avatarSeedOf('u1', '')).toBe('u1');
  });
  it('랜덤 값은 매번 다르고 40자 이하(DB 한도)이며, 다른 모습을 만든다', () => {
    const a = randomAvatarSeed();
    const b = randomAvatarSeed();
    expect(a).not.toBe(b);
    expect(a.length).toBeLessThanOrEqual(40);
    expect(JSON.stringify(avatarGrid(a))).not.toEqual(JSON.stringify(avatarGrid(b)));
  });
});

describe('computeFriends', () => {
  const members = {
    a: [{ userId: 'me', name: '나' }, { userId: 'f1', name: '김복순' }],
    b: [{ userId: 'me', name: '나' }, { userId: 'f1', name: '김복순' }, { userId: 'f2', name: '이재헌', pixelSeed: 'seed-f2' }],
    c: [{ userId: 'me', name: '나' }],
  };
  it('나를 뺀 같이 다닌 사람을 횟수 순으로', () => {
    expect(computeFriends(['a', 'b', 'c'], members, 'me')).toEqual([
      { userId: 'f1', name: '김복순', seed: 'f1', trips: 2 },
      { userId: 'f2', name: '이재헌', seed: 'seed-f2', trips: 1 },
    ]);
  });
  it('혼자 다닌 여행뿐이면 빈 목록', () => {
    expect(computeFriends(['c'], members, 'me')).toEqual([]);
    expect(computeFriends([], undefined, 'me')).toEqual([]);
  });
});
