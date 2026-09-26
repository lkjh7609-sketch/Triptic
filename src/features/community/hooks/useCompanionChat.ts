import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import i18next from '@/shared/i18n';
import {
  listCompanionMessages,
  sendCompanionMessage,
  subscribeToCompanionMessages,
  unsubscribeCompanionMessages,
} from '../companionMessageService';
import { badwordScore } from '../moderation/badwords';
import { spamScore } from '../moderation/spamHeuristics';
import type { CompanionMessage } from '../types';

const OBVIOUS_ABUSE_THRESHOLD = 0.85;

export function companionMessagesQueryKey(postId: string) {
  return ['community', 'companion', 'messages', postId] as const;
}

/** 초기 메시지 로드 + 실시간 구독(새 메시지는 쿼리 캐시에 바로 append) */
export function useCompanionMessages(postId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = companionMessagesQueryKey(postId ?? '');

  const query = useQuery({
    queryKey,
    queryFn: () => listCompanionMessages(postId!),
    enabled: !!postId,
  });

  useEffect(() => {
    if (!postId) return;
    const channel = subscribeToCompanionMessages(postId, (message) => {
      queryClient.setQueryData<CompanionMessage[]>(queryKey, (old) => {
        if (!old) return [message];
        if (old.some((m) => m.id === message.id)) return old; // 중복 방지
        return [...old, message];
      });
    });
    return () => unsubscribeCompanionMessages(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  return query;
}

export function useSendCompanionMessage(postId: string, senderId: string | null) {
  return useMutation({
    mutationFn: (body: string) => {
      if (!senderId) throw new Error(i18next.t('common:auth.loginRequired'));
      const trimmed = body.trim();
      // 순수 함수 즉석 체크 — 네트워크 없이 명백한 욕설/스팸만 미리 막는다.
      // 보안 경계가 아니라 UX 안내용이다(실제 경계는 RLS 멤버십 체크 + 신고).
      const score = Math.max(badwordScore(trimmed), spamScore(trimmed));
      if (score >= OBVIOUS_ABUSE_THRESHOLD) {
        throw new Error(i18next.t('community:companion.chat.badwordBlocked'));
      }
      return sendCompanionMessage(postId, senderId, trimmed);
      // 내가 보낸 메시지도 realtime INSERT 이벤트로 돌아와 캐시에 append된다
      // (postgres_changes는 발신자에게도 브로드캐스트된다) — 별도 낙관적
      // 업데이트나 invalidate 불필요.
    },
  });
}
