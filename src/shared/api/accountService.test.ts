import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.fn();
const signOut = vi.fn();
vi.mock('./supabaseClient', () => ({ getSupabaseClient: () => ({ auth: { getSession, signOut } }) }));
const clearOfflineCache = vi.fn();
vi.mock('@/shared/offline/persister', () => ({ clearOfflineCache }));

const { AccountDeletionError, finishLocalSignOutAfterDeletion, requestAccountDeletion } = await import('./accountService');

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
