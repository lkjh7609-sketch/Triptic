import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthRetryableFetchError, AuthSessionMissingError } from '@supabase/supabase-js';

const getUser = vi.fn();
const getSession = vi.fn();
vi.mock('./supabaseClient', () => ({
  getSupabaseClient: () => ({ auth: { getUser, getSession } }),
  supabaseAuthStorageKey: () => 'sb-test-auth-token',
}));
vi.mock('@/shared/offline/persister', () => ({ clearOfflineCache: vi.fn() }));

const { getCurrentUser, readStoredSessionUser } = await import('./authService');

afterEach(() => {
  localStorage.clear();
  getUser.mockReset();
  getSession.mockReset();
});

describe('readStoredSessionUser', () => {
  it('저장된 세션의 사용자를 네트워크 없이 읽는다(만료돼도)', () => {
    localStorage.setItem('sb-test-auth-token', JSON.stringify({ refresh_token: 'r', expires_at: 1, user: { id: 'u1' } }));
    expect(readStoredSessionUser()).toEqual({ id: 'u1' });
  });

  it('없거나 깨졌거나 갱신 토큰이 없으면 null', () => {
    expect(readStoredSessionUser()).toBeNull();
    localStorage.setItem('sb-test-auth-token', '{not json');
    expect(readStoredSessionUser()).toBeNull();
    localStorage.setItem('sb-test-auth-token', JSON.stringify({ user: { id: 'u1' } }));
    expect(readStoredSessionUser()).toBeNull();
  });
});

describe('getCurrentUser', () => {
  it('서버에 못 닿으면(회선 문제) 로그아웃으로 보지 않고 이 기기의 세션을 쓴다', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: new AuthRetryableFetchError('Failed to fetch', 0) });
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    await expect(getCurrentUser()).resolves.toEqual({ id: 'u1' });
  });

  it('세션이 없으면 null', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: new AuthSessionMissingError() });
    await expect(getCurrentUser()).resolves.toBeNull();
    expect(getSession).not.toHaveBeenCalled();
  });
});
