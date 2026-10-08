import { beforeEach, describe, expect, it, vi } from 'vitest';

const signInWithOAuth = vi.fn();
vi.mock('./supabaseClient', () => ({
  getSupabaseClient: () => ({ auth: { signInWithOAuth } }),
  supabaseAuthStorageKey: () => null,
}));
vi.mock('@/shared/offline/persister', () => ({ clearOfflineCache: vi.fn() }));
let native = true;
vi.mock('@/shared/platform', () => ({ isNativeApp: () => native }));
const open = vi.fn(async (_options: unknown) => {});
vi.mock('@capacitor/browser', () => ({ Browser: { open: (o: unknown) => open(o) } }));
vi.mock('@/shared/i18n', () => ({ default: { t: (k: string) => k } }));
vi.mock('@/shared/monitoring', () => ({ captureError: vi.fn() }));
vi.mock('@/shared/ui/toast', () => ({ showToast: vi.fn() }));

import { signInWithProvider } from './authService';

describe('signInWithProvider — 앱에서는 인앱 브라우저로', () => {
  beforeEach(() => {
    signInWithOAuth.mockReset();
    open.mockClear();
    native = true;
  });

  it('앱: 웹뷰를 이동시키지 않고(skipBrowserRedirect) 로그인 주소를 인앱 브라우저로 연다, 돌아올 주소는 앱 전용 주소', async () => {
    signInWithOAuth.mockResolvedValue({ data: { url: 'https://accounts.google.com/o/oauth2/v2/auth?x=1', provider: 'google' }, error: null });
    await signInWithProvider('google');
    expect(signInWithOAuth).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: 'com.triptic.travel://auth/callback', skipBrowserRedirect: true } });
    expect(open).toHaveBeenCalledWith({ url: 'https://accounts.google.com/o/oauth2/v2/auth?x=1' });
  });

  it('앱: 공급자 오류는 던지고 브라우저는 열지 않는다', async () => {
    signInWithOAuth.mockResolvedValue({ data: { url: null }, error: new Error('provider disabled') });
    await expect(signInWithProvider('kakao')).rejects.toThrow('provider disabled');
    expect(open).not.toHaveBeenCalled();
  });

  it('앱: 주소가 안 오면 던진다', async () => {
    signInWithOAuth.mockResolvedValue({ data: { url: null }, error: null });
    await expect(signInWithProvider('apple')).rejects.toThrow('no oauth url');
    expect(open).not.toHaveBeenCalled();
  });

  it('웹: 예전처럼 브라우저가 직접 이동(앱 전용 주소를 쓰지 않는다)', async () => {
    native = false;
    signInWithOAuth.mockResolvedValue({ data: { url: 'https://x', provider: 'google' }, error: null });
    await signInWithProvider('google', '/plan');
    const arg = signInWithOAuth.mock.calls[0][0];
    expect(arg.options.redirectTo).toMatch(/^https?:\/\/.+\/plan$/);
    expect(arg.options.redirectTo).not.toContain('com.triptic.travel');
    expect(arg.options.skipBrowserRedirect).toBeUndefined();
    expect(open).not.toHaveBeenCalled();
  });
});
