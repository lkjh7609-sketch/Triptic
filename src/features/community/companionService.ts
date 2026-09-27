/**
 * 동행찾기 데이터 접근 계층 (0032 마이그레이션과 1:1 대응)
 * communityService.ts와 같은 패턴 — RLS로 안전한 조회/철회는 직접
 * supabase.from()/rpc(), 모더레이션이 필요한 생성만 moderate-content 경유.
 */
import { getSupabaseClient } from '@/shared/api/supabaseClient';
import { can } from '@/shared/entitlements';
import i18next, { normalizeLocale } from '@/shared/i18n';
import type {
  CommunityProfile,
  CompanionApplication,
  CompanionApplicationStatus,
  CompanionMatchMember,
  CompanionPost,
  CompanionPostStatus,
} from './types';

function currentLocale(): string {
  return normalizeLocale(i18next.language);
}

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

async function fetchProfilesByIds(ids: string[]): Promise<Map<string, CommunityProfile>> {
  const supabase = getSupabaseClient();
  const distinct = uniq(ids);
  if (distinct.length === 0) return new Map();
  const { data, error } = await supabase.from('community_profiles').select('*').in('id', distinct);
  if (error) throw error;
  return new Map((data as CommunityProfile[]).map((p) => [p.id, p]));
}

async function fetchDestinationNamesByIds(ids: string[], locale = currentLocale()): Promise<Map<string, string>> {
  const supabase = getSupabaseClient();
  const distinct = uniq(ids);
  if (distinct.length === 0) return new Map();
  const fallbacks = [...new Set([locale, 'en', 'ko'])];
  const { data, error } = await supabase
    .from('destination_translations')
    .select('destination_id, locale, name')
    .in('locale', fallbacks)
    .in('destination_id', distinct);
  if (error) throw error;
  const names = new Map<string, string>();
  const rows = (data as { destination_id: string; locale: string; name: string }[]) ?? [];
  for (const loc of [...fallbacks].reverse()) {
    for (const row of rows) if (row.locale === loc) names.set(row.destination_id, row.name);
  }
  return names;
}

async function enrichCompanionPosts(
  rows: CompanionPost[],
  viewerId: string | null,
  locale = currentLocale(),
): Promise<CompanionPost[]> {
  if (rows.length === 0) return [];
  const [profileMap, nameMap, myApplicationMap] = await Promise.all([
    fetchProfilesByIds(rows.map((r) => r.author_id)),
    fetchDestinationNamesByIds(rows.map((r) => r.destination_id).filter((id): id is string => id !== null), locale),
    fetchMyApplicationsByPostIds(
      rows.map((r) => r.id),
      viewerId,
    ),
  ]);
  return rows.map((r) => ({
    ...r,
    author: profileMap.get(r.author_id),
    destination: r.destination_id ? { id: r.destination_id, slug: '', name: nameMap.get(r.destination_id) ?? '' } : undefined,
    myApplication: myApplicationMap.get(r.id),
  }));
}

async function fetchMyApplicationsByPostIds(
  postIds: string[],
  viewerId: string | null,
): Promise<Map<string, CompanionApplication>> {
  if (!viewerId || postIds.length === 0) return new Map();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('companion_applications')
    .select('*')
    .eq('applicant_id', viewerId)
    .in('post_id', uniq(postIds));
  if (error) throw error;
  return new Map((data as CompanionApplication[]).map((a) => [a.post_id, a]));
}

// ── 모집글 조회 ─────────────────────────────────────────────────────────
export interface CompanionPostsPage {
  posts: CompanionPost[];
  nextCursor: { created_at: string; id: string } | null;
}

export async function listCompanionPosts(opts: {
  destinationId?: string;
  viewerId?: string | null;
  cursor?: { created_at: string; id: string } | null;
  limit?: number;
}): Promise<CompanionPostsPage> {
  const supabase = getSupabaseClient();
  const limit = opts.limit ?? 20;
  let query = supabase
    .from('companion_posts')
    .select('*')
    .eq('status', 'recruiting')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);

  if (opts.destinationId) query = query.eq('destination_id', opts.destinationId);
  if (opts.cursor) {
    query = query.or(
      `created_at.lt.${opts.cursor.created_at},and(created_at.eq.${opts.cursor.created_at},id.lt.${opts.cursor.id})`,
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data as CompanionPost[]) ?? [];
  const posts = await enrichCompanionPosts(rows, opts.viewerId ?? null);
  const last = rows[rows.length - 1];
  const nextCursor = rows.length === limit && last ? { created_at: last.created_at, id: last.id } : null;
  return { posts, nextCursor };
}

export async function getCompanionPost(postId: string, viewerId: string | null): Promise<CompanionPost | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('companion_posts').select('*').eq('id', postId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [enriched] = await enrichCompanionPosts([data as CompanionPost], viewerId);
  return enriched;
}

/** 내 동행 — 내가 주최 중이거나(모집중/확정) 지원해 진행 중인(대기/수락) 모집글.
 * 확정(matched)되면 공개 목록(recruiting)에서 빠지므로, 지원자가 확정된 모임
 * 채팅방으로 돌아올 수 있는 유일한 진입점이다. 확정 모임은 "read companion
 * posts as member"(0032) 정책으로 수락된 지원자에게도 읽힌다. */
export async function listMyActiveCompanionPosts(userId: string): Promise<CompanionPost[]> {
  const supabase = getSupabaseClient();
  const { data: apps, error: appErr } = await supabase
    .from('companion_applications')
    .select('post_id')
    .eq('applicant_id', userId)
    .in('status', ['pending', 'accepted']);
  if (appErr) throw appErr;
  const appliedIds = uniq(((apps ?? []) as { post_id: string }[]).map((a) => a.post_id));

  let query = supabase
    .from('companion_posts')
    .select('*')
    .in('status', ['recruiting', 'matched'])
    .is('deleted_at', null)
    .order('start_date', { ascending: true });
  query = appliedIds.length > 0 ? query.or(`author_id.eq.${userId},id.in.(${appliedIds.join(',')})`) : query.eq('author_id', userId);

  const { data, error } = await query;
  if (error) throw error;
  return enrichCompanionPosts((data as CompanionPost[]) ?? [], userId);
}

// ── 모집글 작성(모더레이션 게이트) ──────────────────────────────────────────
export interface CreateCompanionPostResult {
  id: string;
  status: CompanionPostStatus;
  failClosed: boolean;
}

export async function createCompanionPost(input: {
  destinationId?: string | null;
  title: string;
  body: string;
  startDate: string; // 'yyyy-MM-dd'
  endDate: string; // 'yyyy-MM-dd'
  groupSize: number;
  userId: string;
}): Promise<CreateCompanionPostResult> {
  // 별도 Feature 플래그 없이 기존 커뮤니티 글쓰기 게이트를 재사용한다(지금은
  // 항상 true지만, 나중에 과금 정책이 생기면 여기 한 곳만 바뀐다).
  if (!can('community.post', { userId: input.userId })) {
    throw new Error(i18next.t('community:errors.postingUnavailable'));
  }
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke('moderate-content', {
    body: {
      kind: 'companion_post',
      destinationId: input.destinationId,
      title: input.title,
      body: input.body,
      startDate: input.startDate,
      endDate: input.endDate,
      groupSize: input.groupSize,
    },
  });
  if (error) throw error;
  return data as CreateCompanionPostResult;
}

export async function cancelCompanionPost(postId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('cancel_companion_post', { p_post_id: postId });
  if (error) throw error;
}

// ── 신청 ────────────────────────────────────────────────────────────────
export interface CreateCompanionApplicationResult {
  id: string;
  status: CompanionApplicationStatus;
  failClosed: boolean;
}

export async function applyToCompanionPost(input: {
  postId: string;
  message?: string;
}): Promise<CreateCompanionApplicationResult> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke('moderate-content', {
    body: { kind: 'companion_application', companionPostId: input.postId, body: input.message ?? '' },
  });
  // 원문("Edge Function returned a non-2xx status code")이 그대로 모달에 뜨던 것 방지
  if (error) throw new Error(i18next.t('community:companion.apply.submitError'), { cause: error });
  return data as CreateCompanionApplicationResult;
}

export async function listApplicationsForPost(postId: string): Promise<CompanionApplication[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('companion_applications')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  const rows = (data as CompanionApplication[]) ?? [];
  const profileMap = await fetchProfilesByIds(rows.map((r) => r.applicant_id));
  return rows.map((r) => ({ ...r, applicant: profileMap.get(r.applicant_id) }));
}

export async function respondToApplication(applicationId: string, accept: boolean): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('respond_companion_application', {
    p_application_id: applicationId,
    p_accept: accept,
  });
  if (error) throw error;
}

export async function withdrawApplication(applicationId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('withdraw_companion_application', { p_application_id: applicationId });
  if (error) throw error;
}

// ── 일정 완료(0046) ─────────────────────────────────────────────────────
/** 주최자만, 시작일 이후에만. 종료일이 지나면 서버 크론이 자동으로 완료한다. */
export async function completeCompanionTrip(postId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('complete_companion_trip', { p_post_id: postId });
  if (error) throw error;
}

// ── 매칭 확정/멤버 ──────────────────────────────────────────────────────
export async function finalizeCompanionMatch(postId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('finalize_companion_match', { p_post_id: postId });
  if (error) throw error;
}

/** 매칭 멤버 = 주최자 + accepted 신청자. 별도 테이블 없이 파생 조합한다(설계 결정, 0032 참고). */
export async function listCompanionMatchMembers(post: CompanionPost): Promise<CompanionMatchMember[]> {
  const supabase = getSupabaseClient();
  // 신청 테이블을 직접 읽으면 RLS상 주최자가 아닌 멤버는 다른 수락 멤버를 못 본다(0048)
  const { data, error } = await supabase.rpc('list_companion_member_ids', { p_post_id: post.id });
  if (error) throw error;
  const memberIds = [post.author_id, ...((data ?? []) as string[]).filter((id) => id !== post.author_id)];
  const profileMap = await fetchProfilesByIds(memberIds);
  return memberIds.map((id) => ({
    user_id: id,
    role: id === post.author_id ? 'organizer' : 'member',
    profile: profileMap.get(id),
  }));
}

// ── QR 상호 검증 ────────────────────────────────────────────────────────
export async function getMyCompanionQrToken(postId: string): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('get_my_companion_qr_token', { p_post_id: postId });
  if (error) throw error;
  return data as string;
}

export interface VerifiedCompanionMember {
  post_id: string;
  title: string;
  member_id: string;
  handle: string | null;
  display_name: string;
  avatar_url: string | null;
}

/** 실패해도 예외를 던지지 않는다 — RPC가 이유를 구분해서 노출하지 않으므로 결과가 없으면 그냥 null. */
export async function verifyCompanionQrToken(token: string): Promise<VerifiedCompanionMember | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('verify_companion_qr_token', { p_token: token });
  if (error) throw error;
  const rows = (data as VerifiedCompanionMember[]) ?? [];
  return rows[0] ?? null;
}
