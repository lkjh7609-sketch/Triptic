/**
 * 계정 삭제 (02-screens.md §5.1, supabase/migrations/0011_account_deletion_request.sql)
 * ⚠️ 0011 마이그레이션이 운영 프로젝트에 아직 적용되지 않았으므로, 이 함수들은
 * 마이그레이션 적용 전까지 "함수를 찾을 수 없음" 오류를 반환한다 — 예상된 동작이다.
 */
import { getSupabaseClient } from './supabaseClient';
import { tripService } from './tripService';

export interface DeletionImpactSummary {
  tripCount: number;
  /** documents/posts 테이블은 아직 운영에 없으므로(Phase 4/5) 항상 0 — 적용되면 실제 값으로 바뀐다 */
  voucherCount: number;
  postCount: number;
}

/** 02-screens.md §5.1 경고 화면: "삭제되는 데이터 명시" */
export async function getDeletionImpactSummary(): Promise<DeletionImpactSummary> {
  const trips = await tripService.listTrips();
  return { tripCount: trips.length, voucherCount: 0, postCount: 0 };
}

export async function requestAccountDeletion(): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('request_account_deletion');
  if (error) throw error;
}

export async function cancelAccountDeletion(): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('cancel_account_deletion');
  if (error) throw error;
}

export async function getOwnDeletionStatus(): Promise<string | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('get_own_deletion_status');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row?.deletion_requested_at ?? null;
}
