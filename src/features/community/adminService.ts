/**
 * 운영 콘솔 데이터 접근 (06-community.md §9 "최소 기능")
 * profiles.role='admin'인 사용자만 RLS로 이 조회들이 실제 데이터를 반환한다
 * (0020/0021의 "admin read all ..."/"admin resolve reports" 정책).
 */
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

/** 신고 대상 미리보기용 — post/comment 본문만 가져온다(user/image는 별도 처리) */
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
  return null;
}
