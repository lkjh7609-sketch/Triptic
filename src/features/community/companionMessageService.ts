/**
 * 동행 채팅 데이터 접근 계층 (0033 마이그레이션과 1:1 대응)
 * moderate-content를 거치지 않는다 — 신고/차단만으로 검열한다(사용자 결정,
 * 실시간 채팅에 3초 동기 분류기는 너무 느리고 실패 시 메시지가 사라지는
 * 경험을 만든다). RLS(is_companion_member)가 실제 보안 경계다.
 */
import { getSupabaseClient } from '@/shared/api/supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { CommunityProfile, CompanionMessage } from './types';

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

/** 최근 메시지 limit개를 오래된 순으로 반환한다(v1은 더 불러오기 없음) */
export async function listCompanionMessages(postId: string, limit = 50): Promise<CompanionMessage[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('companion_messages')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = ((data as CompanionMessage[]) ?? []).reverse();
  const profileMap = await fetchProfilesByIds(rows.map((r) => r.sender_id));
  return rows.map((r) => ({ ...r, sender: profileMap.get(r.sender_id) }));
}

export async function sendCompanionMessage(postId: string, senderId: string, body: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('companion_messages').insert({ post_id: postId, sender_id: senderId, body });
  if (error) throw error;
}

/** 새 메시지 실시간 구독. 반환값을 unsubscribeCompanionMessages에 넘겨 정리한다. */
export function subscribeToCompanionMessages(
  postId: string,
  onInsert: (message: CompanionMessage) => void,
): RealtimeChannel {
  const supabase = getSupabaseClient();
  const channel = supabase
    .channel(`companion_messages:${postId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'companion_messages', filter: `post_id=eq.${postId}` },
      (payload) => {
        onInsert(payload.new as CompanionMessage);
      },
    )
    .subscribe();
  return channel;
}

export function unsubscribeCompanionMessages(channel: RealtimeChannel): void {
  const supabase = getSupabaseClient();
  void supabase.removeChannel(channel);
}
