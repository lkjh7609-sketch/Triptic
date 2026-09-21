/**
 * Supabase Auth 서비스 (새 React 앱 전용 — src/services/authService.js 이식)
 * 로직은 그대로 유지하고, 클라이언트 획득만 동기 방식(getSupabaseClient)으로 바뀐다.
 * Sign in with Apple 배선 추가 (02-screens.md §6: "Apple 로그인을 첫 번째로 배치").
 * ⚠️ Apple Developer Program 미가입 상태 — Supabase 프로젝트에 Apple OAuth
 * 공급자가 아직 설정되지 않았으므로, 버튼은 동작하되 실제 인증은 완료되지 않는다.
 */
import type { Session, User, AuthChangeEvent } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabaseClient';
import { clearOfflineCache } from '@/shared/offline/persister';

export type AuthProvider = 'apple' | 'google' | 'kakao';

function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.protocol === 'capacitor:' ||
    typeof (window as unknown as { Capacitor?: unknown }).Capacitor !== 'undefined'
  );
}

function isLocalHost(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

export async function signInWithProvider(provider: AuthProvider) {
  const client = getSupabaseClient();
  // Vercel Preview URL의 Deployment Protection(SSO 로그인) 우회를 위해 프로덕션 도메인 우선 적용
  const redirectUrl = isLocalHost() && !isNativeApp() ? window.location.origin : 'https://triptic.my';

  const result = await client.auth.signInWithOAuth({
    provider,
    options: { redirectTo: redirectUrl },
  });

  if (result.error) {
    throw result.error;
  }

  return result.data;
}

export async function signOut(): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client.auth.signOut();
  if (error) {
    throw error;
  }
  // 다음 로그인(다른 계정일 수 있음)에 이전 계정의 캐시된 여행이 잠깐
  // 보이는 것을 막는다(§3.2 오프라인 캐시).
  await clearOfflineCache();
}

export async function getCurrentUser(): Promise<User | null> {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.getUser();
  if (error) {
    return null;
  }
  return data.user;
}

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
): { unsubscribe: () => void } {
  const client = getSupabaseClient();
  const {
    data: { subscription },
  } = client.auth.onAuthStateChange(callback);

  return {
    unsubscribe() {
      subscription.unsubscribe();
    },
  };
}
