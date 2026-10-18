/**
 * 계정 삭제 (02-screens.md §5.1) — 즉시 삭제(서버 api/deleteAccount.js, supabase/migrations/0065).
 * 예전의 "삭제 요청만 기록 + 30일 뒤 삭제"는 30일 뒤 처리를 끝내 만들지 않아 계정이 영영 남았다.
 */
import { apiUrl } from './apiUrl';
import { clearOfflineCache } from '@/shared/offline/persister';
import { getSupabaseClient } from './supabaseClient';
import { tripService } from './tripService';

export interface DeletionImpactSummary {
  tripCount: number;
  voucherCount: number;
  /** posts 테이블은 아직 운영에 없으므로(Phase 5 커뮤니티 미착수) 항상 0 */
  postCount: number;
}

/** 02-screens.md §5.1 경고 화면: "삭제되는 데이터 명시" */
export async function getDeletionImpactSummary(): Promise<DeletionImpactSummary> {
  const supabase = getSupabaseClient();
  const [trips, { count: voucherCount }] = await Promise.all([
    tripService.listTrips(),
    supabase.from('documents').select('id', { count: 'exact', head: true }).is('deleted_at', null),
  ]);
  return { tripCount: trips.length, voucherCount: voucherCount ?? 0, postCount: 0 };
}

export class AccountDeletionError extends Error {
  constructor(readonly code: 'reauth_required' | 'admin_cannot_delete' | 'failed') {
    super(code);
    this.name = 'AccountDeletionError';
  }
}

/**
 * Apple 로그인 계정이면 탈퇴 직전 다시 로그인한 세션의 Apple 토큰 — 서버가 Apple에 철회한다(심사 지침 5.1.1(v)).
 * Supabase는 Apple 로그인 직후 세션에만 provider_refresh_token/provider_token을 넣어 준다. 없으면 null(서버는 탈퇴만 한다).
 */
export function appleTokenForRevoke(
  session: { provider_token?: string | null; provider_refresh_token?: string | null; user?: { app_metadata?: { provider?: string } } } | null | undefined,
): { appleToken: string; appleTokenType: 'refresh_token' | 'access_token' } | null {
  // 탈퇴 전 재로그인은 처음 가입한 방법(app_metadata.provider)으로 한다 — 그게 Apple일 때만 세션의 토큰이 Apple 것이다
  // (Google로 가입하고 Apple을 나중에 연결한 계정이면 세션 토큰은 Google 것이라 보내지 않는다)
  if (session?.user?.app_metadata?.provider !== 'apple') return null;
  if (session?.provider_refresh_token) return { appleToken: session.provider_refresh_token, appleTokenType: 'refresh_token' };
  if (session?.provider_token) return { appleToken: session.provider_token, appleTokenType: 'access_token' };
  return null;
}

/**
 * 회원 탈퇴 — 서버(api/deleteAccount.js)가 그 자리에서 삭제한다: 예약 서류 파일, 여행·게시글·동행 기록 등 모든 데이터, 로그인 계정.
 * 되돌릴 수 없다. 방금(15분 안) 다시 로그인한 세션만 받고, 아니면 reauth_required. Apple 로그인 계정이면 Apple 토큰도 함께 보낸다.
 */
export async function requestAccountDeletion(): Promise<void> {
  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new AccountDeletionError('failed');
  const apple = appleTokenForRevoke(data.session);
  const res = await fetch(apiUrl('/api/deleteAccount'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, ...(apple ? { 'Content-Type': 'application/json' } : {}) },
    ...(apple ? { body: JSON.stringify(apple) } : {}),
  });
  if (res.ok) return;
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (json.error === 'reauth_required') throw new AccountDeletionError('reauth_required');
  if (json.error === 'admin_cannot_delete') throw new AccountDeletionError('admin_cannot_delete');
  throw new AccountDeletionError('failed');
}

/** 삭제가 끝난 뒤 이 기기의 로그인 상태와 저장된 캐시를 지운다 — 계정이 이미 없어 서버 로그아웃이 실패해도 이 기기에서는 로그아웃된다 */
export async function finishLocalSignOutAfterDeletion(): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
  await clearOfflineCache();
}
