import type { SupabaseClient } from '@supabase/supabase-js';
import i18n from '@/shared/i18n';
import { captureError } from '@/shared/monitoring';
import { showToast } from '@/shared/ui/toast';
import { isNativeApp } from '@/shared/platform';
import { getSupabaseClient } from './supabaseClient';

/**
 * 앱(iOS 셸)의 소셜 로그인 — 구글은 앱 안 웹뷰에서 하는 로그인을 막으므로, 인앱 브라우저(SFSafariViewController)로 로그인 창을 열고
 * 끝나면 앱 전용 주소로 돌아온다: com.triptic.travel://auth/callback?code=… (Info.plist의 URL scheme).
 * 코드를 받아 앱이 세션으로 바꾼다(PKCE — 코드만으로는 다른 앱이 가로채도 로그인할 수 없다).
 * ⚠️ 이 주소는 Supabase 대시보드 Authentication → URL Configuration → Redirect URLs에 등록돼 있어야 한다.
 */
export const NATIVE_AUTH_SCHEME = 'com.triptic.travel';
export const NATIVE_AUTH_REDIRECT = `${NATIVE_AUTH_SCHEME}://auth/callback`;

export type AuthCallback = { kind: 'code'; code: string } | { kind: 'error'; message: string };

/** 앱 주소로 돌아온 URL을 읽는다 — 로그인 콜백이 아니면 null */
export function parseAuthCallback(url: string): AuthCallback | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== `${NATIVE_AUTH_SCHEME}:` || parsed.hostname !== 'auth' || parsed.pathname !== '/callback') return null;
  // 정상이면 ?code=…, 오류면 ?error=…&error_description=… (구현에 따라 #fragment로 오기도 해서 둘 다 본다)
  const params = new URLSearchParams(parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash);
  parsed.searchParams.forEach((value, key) => {
    if (!params.has(key)) params.set(key, value);
  });
  const error = params.get('error_description') || params.get('error');
  if (error) return { kind: 'error', message: error };
  const code = params.get('code');
  if (code) return { kind: 'code', code };
  return { kind: 'error', message: 'missing code' };
}

/** 돌아온 로그인 콜백을 처리한다. 처리했으면(성공이든 실패든) true, 로그인 콜백이 아니면 false */
export async function handleAuthCallbackUrl(url: string, client: SupabaseClient = getSupabaseClient()): Promise<boolean> {
  const callback = parseAuthCallback(url);
  if (!callback) return false;
  try {
    if (callback.kind === 'error') throw new Error(callback.message);
    const { error } = await client.auth.exchangeCodeForSession(callback.code);
    if (error) throw error;
  } catch (err) {
    captureError(err, { context: 'nativeAuthCallback' });
    showToast(i18n.t('auth.loginFailed'));
  }
  return true;
}

/**
 * 앱이 열릴 때·돌아올 때 들어오는 주소를 듣는다(@capacitor/app). 로그인 콜백이면 세션으로 바꾸고 인앱 브라우저를 닫는다.
 * 앱이 아니면 아무것도 하지 않는다. 돌려주는 함수로 듣기를 멈춘다.
 */
export function installNativeAuthListener(): () => void {
  if (!isNativeApp()) return () => {};
  let removed = false;
  let remove: (() => void) | null = null;

  async function onUrl(url: string) {
    if (!(await handleAuthCallbackUrl(url))) return;
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.close();
    } catch {
      // 이미 닫혔으면 무시
    }
  }

  void (async () => {
    try {
      const { App } = await import('@capacitor/app');
      const handle = await App.addListener('appUrlOpen', ({ url }) => void onUrl(url));
      if (removed) void handle.remove();
      else remove = () => void handle.remove();
      // 앱이 꺼져 있다가 로그인 주소로 켜진 경우
      const launch = await App.getLaunchUrl();
      if (launch?.url) void onUrl(launch.url);
    } catch (err) {
      captureError(err, { context: 'nativeAuthListener' });
    }
  })();

  return () => {
    removed = true;
    remove?.();
  };
}
