import { beforeEach, describe, expect, it, vi } from 'vitest';

const showToast = vi.fn();
vi.mock('@/shared/ui/toast', () => ({ showToast: (m: string) => showToast(m) }));
vi.mock('@/shared/monitoring', () => ({ captureError: vi.fn() }));
vi.mock('@/shared/i18n', () => ({ default: { t: (k: string) => k } }));
vi.mock('./supabaseClient', () => ({ getSupabaseClient: () => ({}) }));
let native = true;
vi.mock('@/shared/platform', () => ({ isNativeApp: () => native }));

import { NATIVE_AUTH_REDIRECT, handleAuthCallbackUrl, installNativeAuthListener, parseAuthCallback } from './nativeAuth';

describe('parseAuthCallback — 앱 주소로 돌아온 로그인 결과', () => {
  it('정상: code를 읽는다', () => {
    expect(parseAuthCallback(`${NATIVE_AUTH_REDIRECT}?code=abc-123`)).toEqual({ kind: 'code', code: 'abc-123' });
  });

  it('오류: error_description을 우선으로 읽는다(query든 #fragment든)', () => {
    expect(parseAuthCallback(`${NATIVE_AUTH_REDIRECT}?error=access_denied&error_description=User%20denied`)).toEqual({ kind: 'error', message: 'User denied' });
    expect(parseAuthCallback(`${NATIVE_AUTH_REDIRECT}#error=server_error`)).toEqual({ kind: 'error', message: 'server_error' });
  });

  it('code도 error도 없으면 오류', () => {
    expect(parseAuthCallback(NATIVE_AUTH_REDIRECT)).toEqual({ kind: 'error', message: 'missing code' });
  });

  it('로그인 콜백이 아닌 주소는 null — 다른 scheme·다른 경로·깨진 주소', () => {
    expect(parseAuthCallback('https://triptic.my/auth/callback?code=x')).toBeNull();
    expect(parseAuthCallback('com.triptic.travel://other/callback?code=x')).toBeNull();
    expect(parseAuthCallback('com.triptic.travel://auth/other?code=x')).toBeNull();
    expect(parseAuthCallback('not a url')).toBeNull();
  });
});

describe('handleAuthCallbackUrl', () => {
  beforeEach(() => showToast.mockClear());

  it('code를 세션으로 바꾼다(성공하면 알림 없음)', async () => {
    const exchangeCodeForSession = vi.fn(async () => ({ error: null }));
    const handled = await handleAuthCallbackUrl(`${NATIVE_AUTH_REDIRECT}?code=abc`, { auth: { exchangeCodeForSession } } as never);
    expect(handled).toBe(true);
    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc');
    expect(showToast).not.toHaveBeenCalled();
  });

  it('교환이 실패하면 로그인 실패 알림(처리한 것으로 true)', async () => {
    const exchangeCodeForSession = vi.fn(async () => ({ error: new Error('bad code') }));
    expect(await handleAuthCallbackUrl(`${NATIVE_AUTH_REDIRECT}?code=abc`, { auth: { exchangeCodeForSession } } as never)).toBe(true);
    expect(showToast).toHaveBeenCalledWith('auth.loginFailed');
  });

  it('공급자가 오류로 돌려보내면 교환하지 않고 알림', async () => {
    const exchangeCodeForSession = vi.fn();
    expect(await handleAuthCallbackUrl(`${NATIVE_AUTH_REDIRECT}?error=access_denied`, { auth: { exchangeCodeForSession } } as never)).toBe(true);
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('auth.loginFailed');
  });

  it('로그인 콜백이 아니면 아무것도 하지 않고 false', async () => {
    const exchangeCodeForSession = vi.fn();
    expect(await handleAuthCallbackUrl('com.triptic.travel://plan/1', { auth: { exchangeCodeForSession } } as never)).toBe(false);
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });
});

describe('installNativeAuthListener', () => {
  it('앱이 아니면 아무것도 듣지 않는다', () => {
    native = false;
    const stop = installNativeAuthListener();
    expect(typeof stop).toBe('function');
    stop();
    native = true;
  });
});
