/**
 * Supabase 클라이언트 싱글톤 (새 React 앱 전용)
 *
 * ⚠️ src/services/supabaseClient.js(레거시)와는 별개다. 레거시는 legacy/index.html이
 * classic <script>로 미리 로드해 둔 UMD window.supabase 전역 + (지금은 지운) /api/env가 내려주던
 * window.ENV를 재사용하는 방식이었다(로더 우회를 위한 레거시 전용 설계).
 * 새 앱은 @supabase/supabase-js를 정식 npm 의존성으로 번들하므로 그 우회가 필요
 * 없고, 대신 Vite 표준 방식(import.meta.env)으로 환경변수를 읽는다.
 * (ADR-001: 비즈니스 로직은 이식하되, 로딩 방식처럼 새 번들러 환경에 맞지 않는
 *  부분까지 그대로 복제하지는 않는다 — 이 판단의 근거를 여기 남긴다.)
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isNativeApp } from '@/shared/platform';

let client: SupabaseClient | null = null;

/**
 * 토큰 갱신 요청은 이 시간 안에 응답이 없으면 끊는다. 휴대폰이 잠들었다 깨거나 와이파이↔LTE가 바뀐 직후엔 요청이 죽은
 * 연결에 실려 응답 없이 멈출 수 있는데, fetch에는 시간 제한이 없어 갱신이 영영 안 끝났다 — 그동안 Supabase의 모든 요청이
 * 갱신을 기다려 화면이 비어 있었다(2026-10-04). 끊으면 auth-js가 새 연결로 다시 시도한다(최대 30초 재시도).
 * 로그인·OAuth 코드 교환(grant_type=password·pkce)과 업로드 같은 다른 요청은 건드리지 않는다.
 */
export const TOKEN_REFRESH_TIMEOUT_MS = 8000;

export function fetchWithRefreshTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (init?.signal || !url.includes('/auth/v1/token') || !url.includes('grant_type=refresh_token')) {
    return fetch(input, init);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TOKEN_REFRESH_TIMEOUT_MS);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

/** supabase-js가 로그인 정보를 저장하는 localStorage 키(기본값과 같은 규칙: sb-<프로젝트 주소 첫 부분>-auth-token) */
export function supabaseAuthStorageKey(): string | null {
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (!url) return null;
  try {
    return `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
  } catch {
    return null;
  }
}

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      'Supabase env vars (VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY) are missing.',
    );
  }

  client = createClient(url, anonKey, {
    // 앱의 소셜 로그인은 앱 전용 주소로 돌아오는 코드(PKCE)로 세션을 만든다(nativeAuth.ts). 웹은 예전 방식 그대로
    ...(isNativeApp() ? { auth: { flowType: 'pkce' as const } } : {}),
    global: { fetch: fetchWithRefreshTimeout },
  });
  return client;
}
