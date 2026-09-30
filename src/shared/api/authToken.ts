import { getSupabaseClient } from './supabaseClient';

/** 로그인한 사용자의 Supabase 액세스 토큰. 비로그인이면 null — 로그인 사용자에게만 여는 서버 API(/api/recommend 등)에 Bearer로 보낸다 */
export async function getAccessToken(): Promise<string | null> {
  try {
    const { data } = await getSupabaseClient().auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

/** 로그인이 필요한 서버 API를 로그인 없이 불렀다 */
export class LoginRequiredError extends Error {
  constructor() {
    super('login_required');
    this.name = 'LoginRequiredError';
  }
}
