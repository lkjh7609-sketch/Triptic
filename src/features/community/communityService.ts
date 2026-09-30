/**
 * 커뮤니티 데이터 접근 계층 (06-community.md)
 * community_profiles가 VIEW라 PostgREST 자동 임베딩(embed) 대상이 아니므로
 * documentService.ts의 listDocuments()와 동일하게 클라이언트에서 배치 조회 후
 * 합친다.
 */
import { getSupabaseClient } from '@/shared/api/supabaseClient';
import { captureError } from '@/shared/monitoring';
import { can } from '@/shared/entitlements';
import i18next, { normalizeLocale } from '@/shared/i18n';
import type {
  Comment,
  CommentStatus,
  CommunityProfile,
  Destination,
  Post,
  PostImage,
  PostStatus,
  ReportReason,
  ReportTargetType,
} from './types';

/** 여행지 이름을 표시 언어로 가져온다(호출부가 locale을 넘기지 않아도) */
function currentLocale(): string {
  return normalizeLocale(i18next.language);
}
const EMPTY_UUID = '00000000-0000-0000-0000-000000000000';

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
  // 요청 언어 이름이 없으면(번역 누락) 영어 → 한국어 순으로 폴백한다 — slug가 그대로 보이지 않게
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

async function fetchImagesByPostIds(postIds: string[]): Promise<Map<string, PostImage[]>> {
  const supabase = getSupabaseClient();
  const distinct = uniq(postIds);
  if (distinct.length === 0) return new Map();
  const { data, error } = await supabase
    .from('post_images')
    .select('*')
    .in('post_id', distinct)
    .order('position', { ascending: true });
  if (error) throw error;
  const map = new Map<string, PostImage[]>();
  (data as PostImage[]).forEach((img) => {
    const list = map.get(img.post_id) ?? [];
    list.push(img);
    map.set(img.post_id, list);
  });
  return map;
}

async function fetchMyLikedPostIds(postIds: string[], userId: string | null): Promise<Set<string>> {
  if (!userId || postIds.length === 0) return new Set();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('reactions')
    .select('target_id')
    .eq('user_id', userId)
    .eq('target_type', 'post')
    .in('target_id', uniq(postIds));
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.target_id as string));
}

async function enrichPosts(rows: Post[], viewerId: string | null, locale = currentLocale()): Promise<Post[]> {
  if (rows.length === 0) return [];
  const [profileMap, nameMap, imageMap, likedSet, bookmarkCounts, bookmarkedSet] = await Promise.all([
    fetchProfilesByIds(rows.map((r) => r.author_id)),
    fetchDestinationNamesByIds(rows.map((r) => r.destination_id).filter((id): id is string => id !== null), locale),
    fetchImagesByPostIds(rows.map((r) => r.id)),
    fetchMyLikedPostIds(rows.map((r) => r.id), viewerId),
    fetchBookmarkCounts(rows.map((r) => r.id)),
    fetchMyBookmarkedPostIds(rows.map((r) => r.id), viewerId),
  ]);
  return rows.map((r) => ({
    ...r,
    author: profileMap.get(r.author_id),
    destination: r.destination_id ? { id: r.destination_id, slug: '', name: nameMap.get(r.destination_id) ?? '' } : undefined,
    images: imageMap.get(r.id) ?? [],
    likedByMe: likedSet.has(r.id),
    bookmark_count: bookmarkCounts[r.id] ?? 0,
    bookmarkedByMe: bookmarkedSet.has(r.id),
  }));
}

// ── 여행기 저장(북마크, 0070) ─────────────────────────────────────────────
/** 글마다 저장한 사람 수(평범한 객체). 테이블이 아직 없거나 실패하면 빈 결과 — 저장 수만 0으로 보인다 */
async function fetchBookmarkCounts(postIds: string[]): Promise<Record<string, number>> {
  if (postIds.length === 0) return {};
  const { data, error } = await getSupabaseClient().rpc('get_post_bookmark_counts', { p_post_ids: postIds });
  if (error) return {};
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { post_id: string; bookmark_count: number }[]) counts[row.post_id] = row.bookmark_count;
  return counts;
}

async function fetchMyBookmarkedPostIds(postIds: string[], viewerId: string | null): Promise<Set<string>> {
  if (!viewerId || postIds.length === 0) return new Set();
  const { data, error } = await getSupabaseClient().from('post_bookmarks').select('post_id').eq('user_id', viewerId).in('post_id', postIds);
  if (error) return new Set();
  return new Set((data ?? []).map((r) => r.post_id as string));
}

export async function addBookmark(userId: string, postId: string): Promise<void> {
  const { error } = await getSupabaseClient().from('post_bookmarks').insert({ user_id: userId, post_id: postId });
  // 이미 저장돼 있으면(23505) 성공으로 친다
  if (error && error.code !== '23505') throw error;
}

export async function removeBookmark(userId: string, postId: string): Promise<void> {
  const { error } = await getSupabaseClient().from('post_bookmarks').delete().eq('user_id', userId).eq('post_id', postId);
  if (error) throw error;
}

/** 내가 저장한 여행기(최근 저장 순) — 지워지거나 숨겨진 글은 빠진다 */
export async function listBookmarkedPosts(userId: string): Promise<Post[]> {
  const supabase = getSupabaseClient();
  const { data: marks, error } = await supabase
    .from('post_bookmarks')
    .select('post_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  const ids = (marks ?? []).map((m) => m.post_id as string);
  if (ids.length === 0) return [];
  const { data: rows, error: postsError } = await supabase.from('posts').select('*').in('id', ids).eq('status', 'published').is('deleted_at', null);
  if (postsError) throw postsError;
  const byId = new Map(((rows as Post[]) ?? []).map((p) => [p.id, p]));
  const ordered = ids.map((id) => byId.get(id)).filter((p): p is Post => !!p);
  return enrichPosts(ordered, userId);
}

/** 글 작성 뒤 "일정 복사 허용"을 켠다(작성자만 — RLS "update own posts"). 새 글의 기본값은 허용 안 함 */
export async function setPostAllowCopy(postId: string, allow: boolean): Promise<void> {
  const { error } = await getSupabaseClient().from('posts').update({ allow_copy: allow }).eq('id', postId);
  if (error) throw error;
}

// ── 여행지 ──────────────────────────────────────────────────────────────
export async function listDestinations(locale = currentLocale()): Promise<Destination[]> {
  const supabase = getSupabaseClient();
  const { data: dests, error } = await supabase.from('destinations').select('*').order('sort_order');
  if (error) throw error;
  const rows = (dests as Omit<Destination, 'name'>[]) ?? [];
  const nameMap = await fetchDestinationNamesByIds(rows.map((d) => d.id), locale);
  return rows.map((d) => ({ ...d, name: nameMap.get(d.id) ?? d.slug }));
}

export async function getDestinationBySlug(slug: string, locale = currentLocale()): Promise<Destination | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('destinations').select('*').eq('slug', slug).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const nameMap = await fetchDestinationNamesByIds([data.id], locale);
  return { ...(data as Omit<Destination, 'name'>), name: nameMap.get(data.id) ?? data.slug };
}

// ── 피드 (§6 커서 페이지네이션) ─────────────────────────────────────────────
export interface PostCursor {
  created_at: string;
  id: string;
}

export interface PostsPage {
  posts: Post[];
  nextCursor: PostCursor | null;
}

export async function listPosts(opts: {
  destinationId?: string;
  followedByUserId?: string;
  viewerId?: string | null;
  cursor?: PostCursor | null;
  limit?: number;
}): Promise<PostsPage> {
  const supabase = getSupabaseClient();
  const limit = opts.limit ?? 20;

  let destinationIds: string[] | null = null;
  if (opts.followedByUserId) {
    const { data: follows, error: followErr } = await supabase
      .from('destination_follows')
      .select('destination_id')
      .eq('user_id', opts.followedByUserId);
    if (followErr) throw followErr;
    destinationIds = (follows ?? []).map((f) => f.destination_id as string);
    if (destinationIds.length === 0) return { posts: [], nextCursor: null };
  }

  let query = supabase
    .from('posts')
    .select('*')
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);

  if (opts.destinationId) query = query.eq('destination_id', opts.destinationId);
  if (destinationIds) query = query.in('destination_id', destinationIds);
  if (opts.cursor) {
    query = query.or(
      `created_at.lt.${opts.cursor.created_at},and(created_at.eq.${opts.cursor.created_at},id.lt.${opts.cursor.id})`,
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data as Post[]) ?? [];
  const posts = await enrichPosts(rows, opts.viewerId ?? null);
  const last = rows[rows.length - 1];
  const nextCursor = rows.length === limit && last ? { created_at: last.created_at, id: last.id } : null;
  return { posts, nextCursor };
}

/** 홈 "인기 여행기" — 최근 N일 안에 올라온 공개 글을 좋아요 많은 순(같으면 최신 순)으로 */
export async function listPopularPosts(opts: { sinceDays?: number; limit?: number; viewerId?: string | null } = {}): Promise<Post[]> {
  const supabase = getSupabaseClient();
  const since = new Date(Date.now() - (opts.sinceDays ?? 30) * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('status', 'published')
    .is('deleted_at', null)
    .gte('created_at', since)
    .order('like_count', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 4);
  if (error) throw error;
  return enrichPosts((data as Post[]) ?? [], opts.viewerId ?? null);
}

export async function getPost(postId: string, viewerId: string | null): Promise<Post | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('posts').select('*').eq('id', postId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [enriched] = await enrichPosts([data as Post], viewerId);
  return enriched;
}

export async function listUserPosts(authorId: string, viewerId: string | null): Promise<Post[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('author_id', authorId)
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return enrichPosts((data as Post[]) ?? [], viewerId);
}

// ── 글쓰기(모더레이션 게이트, §5.1) ────────────────────────────────────────
export interface CreatePostResult {
  id: string;
  status: PostStatus;
  failClosed: boolean;
}

export async function createPost(input: {
  destinationId?: string | null;
  body: string;
  tripId?: string | null;
  images?: { storagePath: string; width?: number; height?: number }[];
  userId: string;
  /** 첨부한 일정을 다른 사람이 복사해도 되는가(0070) — 일정을 첨부했을 때만 의미 있다 */
  allowCopy?: boolean;
}): Promise<CreatePostResult> {
  if (!can('community.post', { userId: input.userId })) {
    throw new Error(i18next.t('community:errors.postingUnavailable'));
  }
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke('moderate-content', {
    body: {
      kind: 'post',
      destinationId: input.destinationId,
      body: input.body,
      tripId: input.tripId ?? null,
      images: input.images ?? [],
    },
  });
  if (error) throw error;
  const result = data as CreatePostResult;
  // 게시는 moderate-content 함수가 하고(복사 허용 값은 그 함수가 모른다), 글이 만들어진 뒤 작성자가 켠다.
  // 실패해도 글은 올라간 상태라 막지 않는다 — 기본값(허용 안 함)으로 남고 작성자가 나중에 다시 켤 수 있다
  if (input.allowCopy && input.tripId && result.id && result.status !== 'removed') {
    try {
      await setPostAllowCopy(result.id, true);
    } catch (err) {
      captureError(err, { context: 'setPostAllowCopy' });
    }
  }
  return result;
}

/** 본인 글 소프트 삭제(soft delete own posts RLS) */
export async function deleteOwnPost(postId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('posts').update({ deleted_at: new Date().toISOString() }).eq('id', postId);
  if (error) throw error;
}

// ── 댓글 ────────────────────────────────────────────────────────────────
export async function listComments(postId: string): Promise<Comment[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('post_id', postId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (error) throw error;
  const rows = (data as Comment[]) ?? [];
  const profileMap = await fetchProfilesByIds(rows.map((r) => r.author_id));
  return rows.map((r) => ({ ...r, author: profileMap.get(r.author_id) }));
}

export interface CreateCommentResult {
  id: string;
  status: CommentStatus;
  failClosed: boolean;
}

export async function createComment(input: {
  postId: string;
  body: string;
  parentId?: string | null;
}): Promise<CreateCommentResult> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke('moderate-content', {
    body: { kind: 'comment', postId: input.postId, body: input.body, parentId: input.parentId ?? null },
  });
  if (error) throw error;
  return data as CreateCommentResult;
}

export async function deleteOwnComment(commentId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('comments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', commentId);
  if (error) throw error;
}

// ── 좋아요 ──────────────────────────────────────────────────────────────
export async function likePost(postId: string, userId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('reactions').insert({ user_id: userId, target_type: 'post', target_id: postId });
  if (error && error.code !== '23505') throw error; // 이미 좋아요 누른 경우(unique 위반)는 무시
}

export async function unlikePost(postId: string, userId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('reactions')
    .delete()
    .eq('user_id', userId)
    .eq('target_type', 'post')
    .eq('target_id', postId);
  if (error) throw error;
}

// ── 여행지 구독 ─────────────────────────────────────────────────────────
export async function followDestination(destinationId: string, userId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('destination_follows').insert({ user_id: userId, destination_id: destinationId });
  if (error && error.code !== '23505') throw error;
}

export async function unfollowDestination(destinationId: string, userId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('destination_follows')
    .delete()
    .eq('user_id', userId)
    .eq('destination_id', destinationId);
  if (error) throw error;
}

export async function listMyFollowedDestinationIds(userId: string): Promise<string[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('destination_follows').select('destination_id').eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map((f) => f.destination_id as string);
}

// ── 차단 (§5.3) ─────────────────────────────────────────────────────────
export async function blockUser(blockedId: string, userId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('blocks').insert({ blocker_id: userId, blocked_id: blockedId });
  if (error && error.code !== '23505') throw error;
}

export async function unblockUser(blockedId: string, userId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('blocks').delete().eq('blocker_id', userId).eq('blocked_id', blockedId);
  if (error) throw error;
}

export async function listMyBlocks(userId: string): Promise<CommunityProfile[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('blocks').select('blocked_id').eq('blocker_id', userId);
  if (error) throw error;
  const ids = (data ?? []).map((b) => b.blocked_id as string);
  const profileMap = await fetchProfilesByIds(ids);
  return ids.map((id) => profileMap.get(id)).filter((p): p is CommunityProfile => !!p);
}

// ── 신고 (§5.2) ─────────────────────────────────────────────────────────
export async function reportContent(input: {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  detail?: string;
  userId: string;
}): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('reports').insert({
    reporter_id: input.userId,
    target_type: input.targetType,
    target_id: input.targetId,
    reason: input.reason,
    detail: input.detail || null,
  });
  if (error) {
    if (error.code === '23505') throw new Error(i18next.t('community:errors.alreadyReported'));
    throw error;
  }
}

// ── 프로필 ──────────────────────────────────────────────────────────────
export async function getCommunityProfile(userId: string): Promise<CommunityProfile | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('community_profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return (data as CommunityProfile | null) ?? null;
}

export async function isAdmin(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
  if (error) return false;
  return data?.role === 'admin';
}

export { EMPTY_UUID };
