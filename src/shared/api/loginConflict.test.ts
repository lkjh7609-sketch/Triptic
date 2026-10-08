import { describe, expect, it } from 'vitest';
import type { User, UserIdentity } from '@supabase/supabase-js';
import { findLoginConflict } from './authService';

const NOW = Date.parse('2026-10-08T12:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const DAY = 86_400_000;

function identity(provider: string, createdAgo: number, lastSignInAgo: number): UserIdentity {
  return {
    id: provider,
    user_id: 'u1',
    identity_id: `${provider}-id`,
    provider,
    identity_data: {},
    created_at: ago(createdAgo),
    last_sign_in_at: ago(lastSignInAgo),
    updated_at: ago(lastSignInAgo),
  } as UserIdentity;
}
const userWith = (identities: UserIdentity[]) => ({ id: 'u1', identities }) as unknown as User;

describe('이미 다른 방법으로 가입된 이메일 판정', () => {
  it('처음 가입(연결 1개)은 충돌 아님', () => {
    expect(findLoginConflict(userWith([identity('google', 1000, 1000)]), NOW)).toBeNull();
  });

  it('예전부터 쓰던 방법으로 다시 로그인하면 충돌 아님', () => {
    const u = userWith([identity('google', 30 * DAY, 1000), identity('kakao', 10 * DAY, 5 * DAY)]);
    expect(findLoginConflict(u, NOW)).toBeNull();
  });

  it('방금 붙은 연결 하나 + 예전 방법이 있으면 충돌 — 시도한 방법·기존 방법·최근 로그인 방법을 돌려준다', () => {
    const u = userWith([identity('google', 30 * DAY, 2 * DAY), identity('apple', 10 * DAY, 9 * DAY), identity('kakao', 5000, 5000)]);
    const c = findLoginConflict(u, NOW)!;
    expect(c.attempted).toBe('kakao');
    expect(c.existing.sort()).toEqual(['apple', 'google']);
    expect(c.recent).toBe('google');
    expect(c.linked.provider).toBe('kakao');
  });

  it('이메일 가입 계정에 구글로 로그인하면 최근 방법은 이메일', () => {
    const u = userWith([identity('email', 3 * DAY, 3 * DAY), identity('google', 2000, 2000)]);
    const c = findLoginConflict(u, NOW)!;
    expect(c.recent).toBe('email');
    expect(c.attempted).toBe('google');
  });

  it('둘 다 방금 만들어졌으면(판정 불가) 충돌로 보지 않는다', () => {
    const u = userWith([identity('google', 2000, 2000), identity('kakao', 3000, 3000)]);
    expect(findLoginConflict(u, NOW)).toBeNull();
  });

  it('사용자가 없거나 연결 정보가 없으면 null', () => {
    expect(findLoginConflict(null, NOW)).toBeNull();
    expect(findLoginConflict({ id: 'x' } as User, NOW)).toBeNull();
  });
});
