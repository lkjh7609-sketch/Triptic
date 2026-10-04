import { getSupabaseClient } from '@/shared/api/supabaseClient';
import { postTitleOf } from '@/features/community/postMeta';

/** 서버가 만드는 커뮤니티 알림(0087) — 내 글에 댓글, 내 댓글에 답글, 내 글·댓글에 좋아요 */
export type CommunityNoticeType = 'post_comment' | 'comment_reply' | 'post_like' | 'comment_like';

export interface CommunityNotice {
  kind: 'community';
  /** 종 목록의 키 — 다른 알림 id와 겹치지 않게 접두어를 붙인다 */
  id: string;
  rowId: string;
  type: CommunityNoticeType;
  actorName: string;
  postId: string;
  commentId: string | null;
  postTitle: string;
  createdAt: string;
  unread: boolean;
}

interface Row {
  id: string;
  kind: CommunityNoticeType;
  actor_name: string | null;
  post_id: string;
  comment_id: string | null;
  post_title: string | null;
  post_body: string | null;
  created_at: string;
  read_at: string | null;
}

export const COMMUNITY_ID_PREFIX = 'community:';

export function toCommunityNotice(row: Row): CommunityNotice {
  return {
    kind: 'community',
    id: COMMUNITY_ID_PREFIX + row.id,
    rowId: row.id,
    type: row.kind,
    actorName: row.actor_name ?? '',
    postId: row.post_id,
    commentId: row.comment_id,
    postTitle: postTitleOf({ title: row.post_title, body: row.post_body ?? '' }),
    createdAt: row.created_at,
    unread: row.read_at === null,
  };
}

export async function listCommunityNotices(): Promise<CommunityNotice[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('list_my_notifications', { p_limit: 30 });
  if (error) throw error;
  return ((data as Row[] | null) ?? []).map(toCommunityNotice);
}

export async function markCommunityNoticesRead(userId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) throw error;
}

export async function deleteCommunityNotice(rowId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('notifications').delete().eq('id', rowId);
  if (error) throw error;
}
