/**
 * 운영 콘솔 데이터 접근 (06-community.md §9 "최소 기능")
 * profiles.role='admin'인 사용자만 RLS로 이 조회들이 실제 데이터를 반환한다
 * (0020/0021의 "admin read all ..."/"admin resolve reports" 정책).
 */
import { apiUrl } from '@/shared/api/apiUrl';
import { getSupabaseClient } from '@/shared/api/supabaseClient';
import type { Report } from './types';

export async function listOpenReports(): Promise<Report[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as Report[]) ?? [];
}

export async function resolveReport(reportId: string, resolution: 'actioned' | 'dismissed', resolverId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('reports')
    .update({ status: resolution, resolved_at: new Date().toISOString(), resolver_id: resolverId })
    .eq('id', reportId);
  if (error) throw error;
}

export async function setPostStatus(postId: string, status: 'published' | 'hidden' | 'removed'): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('posts').update({ status }).eq('id', postId);
  if (error) throw error;
}

export async function setCommentStatus(commentId: string, status: 'published' | 'hidden' | 'removed'): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('comments').update({ status }).eq('id', commentId);
  if (error) throw error;
}

export async function setImageStatus(imageId: string, status: 'published' | 'removed'): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('post_images').update({ status }).eq('id', imageId);
  if (error) throw error;
}

export async function listPendingReviewPosts() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('status', 'pending_review')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** 0032: 동행찾기 모집글 — status 값이 posts와 다르므로(recruiting 등) 별도 setter가 필요하다 */
export async function setCompanionPostStatus(
  postId: string,
  status: 'recruiting' | 'hidden' | 'removed',
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('companion_posts').update({ status }).eq('id', postId);
  if (error) throw error;
}

export async function setCompanionApplicationStatus(applicationId: string, status: 'removed'): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('companion_applications').update({ status }).eq('id', applicationId);
  if (error) throw error;
}

export async function setCompanionMessageStatus(messageId: string, status: 'removed'): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('companion_messages').update({ status }).eq('id', messageId);
  if (error) throw error;
}

export async function listPendingReviewCompanionPosts() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('companion_posts')
    .select('*')
    .eq('status', 'pending_review')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** 신고 대상 미리보기용 — post/comment/동행찾기 본문만 가져온다(user/image는 별도 처리) */
export async function getReportTargetPreview(
  targetType: Report['target_type'],
  targetId: string,
): Promise<{ body: string } | null> {
  const supabase = getSupabaseClient();
  if (targetType === 'post') {
    const { data } = await supabase.from('posts').select('body').eq('id', targetId).maybeSingle();
    return data ? { body: data.body } : null;
  }
  if (targetType === 'comment') {
    const { data } = await supabase.from('comments').select('body').eq('id', targetId).maybeSingle();
    return data ? { body: data.body } : null;
  }
  if (targetType === 'companion_post') {
    const { data } = await supabase.from('companion_posts').select('title, body').eq('id', targetId).maybeSingle();
    return data ? { body: `${data.title}\n${data.body}` } : null;
  }
  if (targetType === 'companion_application') {
    const { data } = await supabase.from('companion_applications').select('message').eq('id', targetId).maybeSingle();
    return data ? { body: data.message ?? '' } : null;
  }
  if (targetType === 'companion_message') {
    const { data } = await supabase.from('companion_messages').select('body').eq('id', targetId).maybeSingle();
    return data ? { body: data.body } : null;
  }
  return null;
}

// ── 사용자 등급 관리(0038) — 검색/변경 둘 다 SECURITY DEFINER RPC라
// 클라이언트는 그냥 호출만 한다(관리자 확인은 함수 내부에서). ────────────
export interface AdminUserRow {
  id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  plan: 'free' | 'pro';
  /** 지금까지 만든 여행 수(삭제해도 안 줄어듦) */
  trips_created_count: number;
  /** 이 사용자에게 적용된 무료 여행 생성 한도(0061) — 프로는 무시 */
  trip_limit: number;
}

/** 운영 '회원' 탭 한 줄(0088·0089 admin_list_members) — 이메일·접속 기록은 운영자만 본다 */
export interface AdminMemberRow {
  id: string;
  display_name: string | null;
  handle: string | null;
  email: string | null;
  plan: 'free' | 'pro';
  gender: 'female' | 'male' | null;
  age_band: string | null;
  created_at: string;
  /** 마지막 로그인(auth) */
  last_sign_in_at: string | null;
  /** 앱을 마지막으로 연 시각(앱이 로그인한 채 열릴 때 기록) */
  last_seen_at: string | null;
  /** 접속 때 IP로 짐작한 국가 코드·도시(대략) */
  last_country: string | null;
  last_city: string | null;
  trips_created_count: number;
  trip_limit: number;
  avatar_url: string | null;
  total_count: number;
}

export interface AdminMemberFilters {
  query: string;
  /** 'female' | 'male' | 'none'(미입력) | '' (전체) */
  gender: string;
  ageBand: string;
  plan: string;
  joinedFrom: string;
  joinedTo: string;
}

export async function adminListMembers(
  f: AdminMemberFilters,
  page: number,
  pageSize: number,
): Promise<{ rows: AdminMemberRow[]; total: number }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('admin_list_members', {
    p_query: f.query,
    p_gender: f.gender || null,
    p_age_band: f.ageBand || null,
    p_plan: f.plan || null,
    p_joined_from: f.joinedFrom || null,
    p_joined_to: f.joinedTo || null,
    p_offset: page * pageSize,
    p_limit: pageSize,
  });
  if (error) throw error;
  const rows = ((data as (AdminMemberRow & { total_count: number | string })[]) ?? []).map((r) => ({ ...r, total_count: Number(r.total_count) }));
  return { rows, total: rows[0]?.total_count ?? 0 };
}

export interface AdminMemberTrip {
  id: string;
  title: string;
  city: string | null;
  start_date: string | null;
  end_date: string | null;
  total_days: number | null;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export async function adminMemberTrips(userId: string): Promise<AdminMemberTrip[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('admin_member_trips', { p_user_id: userId });
  if (error) throw error;
  return (data as AdminMemberTrip[]) ?? [];
}

/** 원래 무료 한도. 사용자별 한도가 이보다 크면 임시 완화를 적용받은 것으로 표시한다 */
export const BASE_FREE_TRIP_LIMIT = 2;

export async function adminSetUserPlan(userId: string, plan: 'free' | 'pro'): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('admin_set_user_plan', { p_user_id: userId, p_plan: plan });
  if (error) throw error;
}

// ── 보관함(0067) — 사용자가 삭제한 글·취소한 동행 모집. 이용자에게는 공개되지 않고 운영자만 읽는다 ─────────────
export interface ArchivedItem {
  id: number;
  source_table: 'posts' | 'companion_posts';
  source_id: string;
  author_id: string;
  author_name: string | null;
  author_handle: string | null;
  reason: 'user_deleted' | 'user_cancelled' | string;
  archived_at: string;
  original_created_at: string | null;
  preview: string;
  comment_count: number;
}

export interface ArchivedDetail {
  snapshot: { title?: string; body?: string; created_at?: string } & Record<string, unknown>;
  children: {
    comments?: Array<{ author_id: string; body: string; created_at?: string }>;
    /** 글에 붙었던 사진(파일은 삭제 후 1달 뒤 지워지고, 지워지면 이 목록도 빈다) */
    post_images?: Array<{ storage_path: string; position?: number; width?: number; height?: number }>;
  };
  reason: string;
  archived_at: string;
}

export async function adminListArchived(page: number, pageSize: number): Promise<{ rows: ArchivedItem[]; hasMore: boolean }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('admin_list_archived_content', { p_limit: pageSize + 1, p_offset: page * pageSize });
  if (error) throw error;
  const rows = (data as ArchivedItem[]) ?? [];
  return { rows: rows.slice(0, pageSize), hasMore: rows.length > pageSize };
}

export async function adminGetArchived(id: number): Promise<ArchivedDetail | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('admin_get_archived_content', { p_id: id });
  if (error) throw error;
  return (data as ArchivedDetail | null) ?? null;
}

/** 사용자별 무료 여행 생성 한도를 정한다(0064) — 더하기가 아니라 값 지정이라 두 번 눌려도 이중으로 늘지 않는다 */
export async function adminSetTripLimit(userId: string, limit: number): Promise<number> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('admin_set_trip_limit', { p_user_id: userId, p_limit: limit });
  if (error) throw error;
  return data as number;
}

export const MAX_TRIP_LIMIT = 1000;

/** 입력칸의 글자를 한도 값으로 — 0~1000의 정수가 아니면 null */
export function parseLimit(text: string): number | null {
  if (!/^\d{1,4}$/.test(text.trim())) return null;
  const n = Number(text);
  return n >= 0 && n <= MAX_TRIP_LIMIT ? n : null;
}

// ── 건의하기(0042) — 목록/상태변경 둘 다 SECURITY DEFINER RPC. ──────────────
export interface AdminFeedbackRow {
  id: string;
  user_id: string;
  display_name: string | null;
  handle: string | null;
  body: string;
  screenshot_path: string | null;
  status: 'new' | 'reviewed';
  created_at: string;
  /** 일반 문의 / 제휴문의(0071) */
  category: 'general' | 'partnership';
}

export type AdminFeedbackFilter = 'all' | 'general' | 'partnership';

export async function adminListFeedback(
  page: number,
  pageSize: number,
  filter: AdminFeedbackFilter = 'all',
): Promise<{ rows: AdminFeedbackRow[]; hasMore: boolean }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('admin_list_feedback', {
    p_offset: page * pageSize,
    p_limit: pageSize + 1,
    p_category: filter === 'all' ? null : filter,
  });
  if (error) throw error;
  const rows = (data as AdminFeedbackRow[]) ?? [];
  return { rows: rows.slice(0, pageSize), hasMore: rows.length > pageSize };
}

export async function adminMarkFeedbackReviewed(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('admin_mark_feedback_reviewed', { p_id: id });
  if (error) throw error;
}

export async function getFeedbackScreenshotSignedUrl(path: string): Promise<string | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage.from('feedback-screenshots').createSignedUrl(path, 600);
  if (error) throw error;
  return data?.signedUrl ?? null;
}

// ── 회원이 만든 여행 보기(0091, 읽기 전용) ─────────────────────────────────────
export interface AdminTripView {
  trip: {
    id: string;
    owner_id: string;
    title: string;
    city: string | null;
    start_date: string | null;
    end_date: string | null;
    total_days: number | null;
    base_currency: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
    owner_name: string | null;
    owner_handle: string | null;
    member_count: number;
  } | null;
  days: { id: string; day_index: number; date: string | null; city_name: string | null; note: string | null }[];
  items: {
    id: string;
    day_id: string;
    position: number;
    type: string;
    title: string;
    subtitle: string | null;
    category: string | null;
    address: string | null;
    start_local: string | null;
    end_local: string | null;
    memo: string | null;
  }[];
  hotels: { id: string; day: number; name: string; address: string | null }[];
  flights: {
    id: string;
    type: string;
    flight_no: string | null;
    airline: string | null;
    dep_iata: string | null;
    dep_name: string | null;
    dep_time: string | null;
    arr_iata: string | null;
    arr_name: string | null;
    arr_time: string | null;
  }[];
}

export async function adminGetTrip(tripId: string): Promise<AdminTripView> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('admin_get_trip', { p_trip_id: tripId });
  if (error) throw error;
  return data as AdminTripView;
}

// ── 운영자 강제 탈퇴(api/deleteAccount.js) ────────────────────────────────────
export class AdminRemoveMemberError extends Error {
  constructor(readonly code: 'reauth_required' | 'admin_cannot_delete' | 'forbidden' | 'failed') {
    super(code);
    this.name = 'AdminRemoveMemberError';
  }
}

export async function adminRemoveMember(userId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new AdminRemoveMemberError('failed');
  const res = await fetch(apiUrl('/api/deleteAccount'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetUserId: userId }),
  });
  if (res.ok) return;
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (json.error === 'reauth_required' || json.error === 'admin_cannot_delete' || json.error === 'forbidden') {
    throw new AdminRemoveMemberError(json.error);
  }
  throw new AdminRemoveMemberError('failed');
}

// ── 보관함 삭제(0091) — 사진 파일을 먼저 지우고 행을 지운다. ids가 null이면 전부 비운다 ──────────────
export async function adminDeleteArchived(ids: number[] | null): Promise<number> {
  const supabase = getSupabaseClient();
  const { data: paths, error: pathErr } = await supabase.rpc('admin_archive_image_paths', { p_ids: ids });
  if (pathErr) throw pathErr;
  const files = (paths as string[] | null) ?? [];
  for (let i = 0; i < files.length; i += 100) {
    const { error } = await supabase.storage.from('post-images').remove(files.slice(i, i + 100));
    if (error) throw error;
  }
  const { data, error } = await supabase.rpc('admin_delete_archived', { p_ids: ids });
  if (error) throw error;
  return (data as number) ?? 0;
}
