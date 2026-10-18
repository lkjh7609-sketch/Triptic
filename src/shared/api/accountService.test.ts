import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.fn();
const signOut = vi.fn();
vi.mock('./supabaseClient', () => ({ getSupabaseClient: () => ({ auth: { getSession, signOut } }) }));
const clearOfflineCache = vi.fn();
vi.mock('@/shared/offline/persister', () => ({ clearOfflineCache }));

const { AccountDeletionError, appleTokenForRevoke, finishLocalSignOutAfterDeletion, requestAccountDeletion } = await import('./accountService');

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

beforeEach(() => {
  getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
});
afterEach(() => {
  getSession.mockReset();
  signOut.mockReset();
  clearOfflineCache.mockReset();
  fetchMock.mockReset();
});

describe('requestAccountDeletion', () => {
  it('토큰을 Bearer로 서버에 보내고, 성공하면 조용히 끝난다', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    await expect(requestAccountDeletion()).resolves.toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/deleteAccount');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer tok');
  });

  it('Apple 로그인 계정이면 다시 로그인한 세션의 Apple 토큰을 함께 보낸다(서버가 철회)', async () => {
    getSession.mockResolvedValue({
      data: { session: { access_token: 'tok', provider_refresh_token: 'apple-r', provider_token: 'apple-a', user: { app_metadata: { provider: 'apple' } } } },
    });
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    await requestAccountDeletion();
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ appleToken: 'apple-r', appleTokenType: 'refresh_token' });
  });

  it('Apple이 아니면 본문 없이 보낸다', async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'tok', provider_refresh_token: 'g-r', user: { app_metadata: { provider: 'google' } } } } });
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    await requestAccountDeletion();
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
  });

  it('로그인 토큰이 없으면 서버를 부르지 않고 실패', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    await expect(requestAccountDeletion()).rejects.toMatchObject({ code: 'failed' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('서버의 오류 종류를 그대로 알린다(다시 로그인 필요 / 운영자 계정 / 그 밖)', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'reauth_required' }) });
    await expect(requestAccountDeletion()).rejects.toMatchObject({ code: 'reauth_required' });
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'admin_cannot_delete' }) });
    await expect(requestAccountDeletion()).rejects.toMatchObject({ code: 'admin_cannot_delete' });
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'delete_failed' }) });
    await expect(requestAccountDeletion()).rejects.toBeInstanceOf(AccountDeletionError);
  });
});

describe('finishLocalSignOutAfterDeletion', () => {
  it('이 기기에서만 로그아웃(서버 호출 없이)하고 캐시를 지운다 — 계정이 이미 없어도 실패하지 않는다', async () => {
    signOut.mockRejectedValue(new Error('user not found'));
    await expect(finishLocalSignOutAfterDeletion()).resolves.toBeUndefined();
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(clearOfflineCache).toHaveBeenCalled();
  });
});

describe('appleTokenForRevoke', () => {
  it('refresh 토큰 우선, 없으면 access 토큰, Apple이 아니거나 토큰이 없으면 null', () => {
    const user = { app_metadata: { provider: 'apple' } };
    expect(appleTokenForRevoke({ provider_refresh_token: 'r', provider_token: 'a', user })).toEqual({ appleToken: 'r', appleTokenType: 'refresh_token' });
    expect(appleTokenForRevoke({ provider_token: 'a', user })).toEqual({ appleToken: 'a', appleTokenType: 'access_token' });
    expect(appleTokenForRevoke({ user })).toBeNull();
    // Google로 가입 + Apple 연결: 재로그인 토큰은 Google 것이라 보내지 않는다
    expect(appleTokenForRevoke({ provider_token: 'g', user: { app_metadata: { provider: 'google', providers: ['google', 'apple'] } } as never })).toBeNull();
    expect(appleTokenForRevoke({ provider_token: 'a', user: { app_metadata: { provider: 'kakao' } } })).toBeNull();
    expect(appleTokenForRevoke(null)).toBeNull();
  });
});
