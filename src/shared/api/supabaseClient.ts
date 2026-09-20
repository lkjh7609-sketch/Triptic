/**
 * Supabase 클라이언트 싱글톤 (새 React 앱 전용)
 *
 * ⚠️ src/services/supabaseClient.js(레거시)와는 별개다. 레거시는 legacy/index.html이
 * classic <script>로 미리 로드해 둔 UMD window.supabase 전역 + /api/env가 내려주는
 * window.ENV를 재사용하는 방식이었다(로더 우회를 위한 레거시 전용 설계).
 * 새 앱은 @supabase/supabase-js를 정식 npm 의존성으로 번들하므로 그 우회가 필요
 * 없고, 대신 Vite 표준 방식(import.meta.env)으로 환경변수를 읽는다.
 * (ADR-001: 비즈니스 로직은 이식하되, 로딩 방식처럼 새 번들러 환경에 맞지 않는
 *  부분까지 그대로 복제하지는 않는다 — 이 판단의 근거를 여기 남긴다.)
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      'Supabase 환경 변수(VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY)를 불러오지 못했습니다.',
    );
  }

  client = createClient(url, anonKey);
  return client;
}
