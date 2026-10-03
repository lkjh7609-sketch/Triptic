import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TOKEN_REFRESH_TIMEOUT_MS, fetchWithRefreshTimeout, supabaseAuthStorageKey } from './supabaseClient';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', fetchMock);
  // 응답 없이 멈춘 요청 — signal이 끊으면 그때 실패한다
  fetchMock.mockImplementation(
    (_input: unknown, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      }),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  fetchMock.mockReset();
});

describe('fetchWithRefreshTimeout', () => {
  it('토큰 갱신 요청이 멈추면 정해진 시간 뒤 끊는다(auth-js가 새 연결로 다시 시도)', async () => {
    const pending = fetchWithRefreshTimeout('https://x.supabase.co/auth/v1/token?grant_type=refresh_token', { method: 'POST' });
    const settled = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(TOKEN_REFRESH_TIMEOUT_MS);
    await settled;
  });

  it('로그인·OAuth 코드 교환·그 밖의 요청에는 시간 제한을 걸지 않는다', () => {
    for (const url of [
      'https://x.supabase.co/auth/v1/token?grant_type=password',
      'https://x.supabase.co/auth/v1/token?grant_type=pkce',
      'https://x.supabase.co/rest/v1/trips',
      'https://x.supabase.co/storage/v1/object/photos/a.jpg',
    ]) {
      void fetchWithRefreshTimeout(url, { method: 'POST' });
    }
    for (const [, init] of fetchMock.mock.calls) expect(init.signal).toBeUndefined();
  });

  it('호출한 쪽이 이미 signal을 주면 그대로 둔다', () => {
    const signal = new AbortController().signal;
    void fetchWithRefreshTimeout('https://x.supabase.co/auth/v1/token?grant_type=refresh_token', { signal });
    expect(fetchMock.mock.calls[0][1].signal).toBe(signal);
  });
});

describe('supabaseAuthStorageKey', () => {
  it('supabase-js 기본 저장 키와 같은 규칙', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://abcdefg.supabase.co');
    expect(supabaseAuthStorageKey()).toBe('sb-abcdefg-auth-token');
  });
});
