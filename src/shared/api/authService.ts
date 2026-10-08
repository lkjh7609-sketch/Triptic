/**
 * Supabase Auth 서비스 (새 React 앱 전용 — src/services/authService.js 이식)
 * 로직은 그대로 유지하고, 클라이언트 획득만 동기 방식(getSupabaseClient)으로 바뀐다.
 * Sign in with Apple 배선 (02-screens.md §6: "Apple 로그인을 첫 번째로 배치") — 운영 Supabase에 Apple 공급자 설정 완료.
 */
import { isAuthRetryableFetchError, type Session, type User, type UserIdentity, type AuthChangeEvent } from '@supabase/supabase-js';
import { getSupabaseClient, supabaseAuthStorageKey } from './supabaseClient';
import { clearOfflineCache } from '@/shared/offline/persister';
import { isNativeApp } from '@/shared/platform';

export type AuthProvider = 'apple' | 'google' | 'kakao';

function isLocalHost(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

export async function signInWithProvider(provider: AuthProvider, redirectPath?: string) {
  const client = getSupabaseClient();
  const currentPath = redirectPath ?? window.location.pathname + window.location.search;
  const redirectUrl = isLocalHost() && !isNativeApp() ? window.location.origin + currentPath : 'https://triptic.my' + currentPath;

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
    // 서버에 닿지 못한 것(회선 문제)은 로그아웃이 아니다 — 이 기기에 남은 세션을 그대로 쓴다.
    // 예전엔 null을 돌려줘서 회선이 잠깐 끊기면 로그인한 사람이 비로그인 화면을 봤다
    if (isAuthRetryableFetchError(error)) {
      const { data: local } = await client.auth.getSession();
      return local.session?.user ?? null;
    }
    return null;
  }
  return data.user;
}

/**
 * 이 기기에 저장된 로그인 사용자를 네트워크 없이 바로 읽는다(만료 여부는 보지 않는다). 첫 화면을 로그인 확인
 * (만료된 세션이면 토큰 갱신 요청)까지 기다리지 않고 그리기 위한 값이라, 진짜 상태는 onAuthStateChange가 이어서 맞춘다.
 */
export function readStoredSessionUser(): User | null {
  const key = supabaseAuthStorageKey();
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { user?: User | null; refresh_token?: unknown } | null;
    const user = parsed?.user;
    return user && typeof user.id === 'string' && typeof parsed?.refresh_token === 'string' ? user : null;
  } catch {
    return null;
  }
}

/** 새로 연결된 로그인 방법으로 간주하는 시간 — 이보다 오래된 연결은 예전부터 쓰던 방법이다 */
const FRESH_LINK_WINDOW_MS = 2 * 60_000;

export interface LoginConflict {
  /** 방금 로그인하려던 방법(google·kakao·apple·email) */
  attempted: string;
  /** 이 이메일로 이미 가입돼 있던 방법들 */
  existing: string[];
  /** 그중 가장 최근에 로그인한 방법 */
  recent: string;
  /** 방금 자동으로 연결된 로그인 방법(막으면서 연결을 끊는다) */
  linked: UserIdentity;
}

/**
 * Supabase는 같은 이메일(인증됨)이면 새 로그인 방법을 기존 계정에 자동으로 연결한다. 로그인 직후 사용자에게 방금(2분 안에)
 * 만들어진 연결이 하나이고 그 전부터 있던 다른 방법이 있으면 "이미 다른 방법으로 가입된 이메일"로 본다.
 * 처음 가입(연결 1개)이나 예전부터 쓰던 방법으로 다시 로그인하는 경우는 null.
 */
export function findLoginConflict(user: User | null | undefined, now = Date.now()): LoginConflict | null {
  const identities = user?.identities ?? [];
  if (identities.length < 2) return null;
  const fresh = identities.filter((i) => i.created_at && now - Date.parse(i.created_at) < FRESH_LINK_WINDOW_MS);
  if (fresh.length !== 1) return null;
  const linked = fresh[0];
  const existing = identities.filter((i) => i !== linked);
  if (existing.length === 0) return null;
  const recent = [...existing].sort((a, b) => Date.parse(b.last_sign_in_at ?? '') - Date.parse(a.last_sign_in_at ?? ''))[0];
  return { attempted: linked.provider, existing: existing.map((i) => i.provider), recent: recent.provider, linked };
}

/**
 * 막기로 한 로그인 — 새로 붙은 연결을 끊고 로그아웃한다(연결을 남기면 다음엔 그대로 로그인돼 버린다).
 * 연결 끊기가 거부되면(Supabase의 '수동 연결' 설정이 꺼져 있는 경우 등) 로그아웃만 하고 오류는 호출한 쪽이 기록한다.
 */
export async function rejectLinkedLogin(linked: UserIdentity): Promise<{ unlinkError: unknown | null }> {
  const client = getSupabaseClient();
  let unlinkError: unknown | null = null;
  const { error } = await client.auth.unlinkIdentity(linked);
  if (error) unlinkError = error;
  try {
    await signOut();
  } catch {
    await client.auth.signOut({ scope: 'local' });
  }
  return { unlinkError };
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

export async function signInWithEmail(email: string, password: string) {
  const client = getSupabaseClient();
  const result = await client.auth.signInWithPassword({ email, password });
  if (result.error) throw result.error;
  return result.data;
}

export async function signUpWithEmail(email: string, password: string, displayName?: string) {
  const client = getSupabaseClient();
  const currentPath = window.location.pathname + window.location.search;
  const redirectUrl = isLocalHost() && !isNativeApp() ? window.location.origin + currentPath : 'https://triptic.my' + currentPath;
  const result = await client.auth.signUp({
    email,
    password,
    options: {
      data: { name: displayName },
      emailRedirectTo: redirectUrl
    }
  });
  if (result.error) throw result.error;
  return result.data;
}

/** 이메일 가입 중복확인 — true면 아직 아무도 안 쓰는 이메일 (0055, 로그인 전에도 호출 가능) */
export async function isEmailAvailable(email: string): Promise<boolean> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc('is_email_available', { p_email: email });
  if (error) throw error;
  return data === true;
}

/** 이용 정지된 이메일로 로그인(또는 다시 가입)했는지 — 정지돼 있으면 사유 코드·조치 시각을 돌려주고(0095), 아니면 null. 정지된 사람이 새로 만든 빈 계정은 서버가 지운다 */
export async function checkMySuspension(): Promise<{ reason: string; reasonText: string | null; suspendedAt: string } | null> {
  const { data, error } = await getSupabaseClient().rpc('check_my_suspension');
  if (error) throw error;
  const row = (data as { reason: string; reason_text: string | null; suspended_at: string }[] | null)?.[0];
  return row ? { reason: row.reason, reasonText: row.reason_text, suspendedAt: row.suspended_at } : null;
}

/** 비밀번호 변경 — 이메일로 가입한 회원만(소셜 로그인 회원은 비밀번호가 없다). 로그인한 세션에서 바로 바꾼다 */
export async function changePassword(newPassword: string): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

/** 어떤 방법으로 가입·로그인했는지 — 'email' | 'google' | 'kakao' | 'apple' 등. 모르면 null */
export function signInProviderOf(user: { app_metadata?: { provider?: string } | null } | null | undefined): string | null {
  return user?.app_metadata?.provider ?? null;
}
