import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Send } from 'lucide-react';
import { useSession } from '@/shared/hooks/useSession';
import { captureError, trackScreenView } from '@/shared/monitoring';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { ReportModal } from './ReportModal';
import { useCompanionMatchMembers, useCompanionPost } from './hooks/useCompanionPosts';
import { useCompanionMessages, useSendCompanionMessage } from './hooks/useCompanionChat';
import type { CompanionMessage } from './types';
import postDetailStyles from './PostDetailScreen.module.css';
import styles from './CompanionChatScreen.module.css';

const MAX_MESSAGE_LENGTH = 1000;

/** 매칭 확정 시 열리는 채팅방(0033) — 별도 방 테이블 없이 postId로 바로 묶인다 */
export function CompanionChatScreen() {
  const { t } = useTranslation(['community', 'common']);
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const { user } = useSession();
  const { data: post, isLoading: postLoading, isError: postError, refetch } = useCompanionPost(postId, user?.id ?? null);
  const membersQuery = useCompanionMatchMembers(post);
  const messagesQuery = useCompanionMessages(postId);
  const sendMessage = useSendCompanionMessage(postId ?? '', user?.id ?? null);

  const [body, setBody] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const listEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    trackScreenView('community_companion_chat');
  }, []);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesQuery.data?.length]);

  if (postLoading) {
    return (
      <div style={{ padding: 16 }}>
        <Skeleton height="160px" />
      </div>
    );
  }
  if (postError || !post || post.status !== 'matched') {
    return <ErrorState summary={t('companion.match.loadError')} onRetry={() => refetch()} />;
  }

  const membersById = new Map((membersQuery.data ?? []).map((m) => [m.user_id, m.profile]));

  async function handleSend() {
    if (!body.trim() || sendMessage.isPending) return;
    setErrorMessage(null);
    try {
      await sendMessage.mutateAsync(body);
      setBody('');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t('companion.chat.sendError'));
      captureError(err, { context: 'sendCompanionMessage' });
    }
  }

  function senderProfile(message: CompanionMessage) {
    return message.sender ?? membersById.get(message.sender_id);
  }

  return (
    <div className={postDetailStyles.wrap}>
      <button type="button" className={postDetailStyles.backBtn} onClick={() => navigate(-1)}>
        ← {t('action.back', { ns: 'common' })}
      </button>

      <div className={styles.header}>
        <h2 className={styles.title}>{post.title}</h2>
        <p className={styles.subtitle}>{t('companion.chat.memberCount', { count: membersQuery.data?.length ?? 0 })}</p>
      </div>

      <div className={styles.messageList}>
        {messagesQuery.isLoading ? (
          <Skeleton height="120px" />
        ) : messagesQuery.isError ? (
          <ErrorState summary={t('companion.chat.loadError')} onRetry={() => messagesQuery.refetch()} />
        ) : (messagesQuery.data ?? []).length === 0 ? (
          <EmptyState message={t('companion.chat.empty')} />
        ) : (
          (messagesQuery.data ?? []).map((message) => {
            const isOwn = message.sender_id === user?.id;
            const profile = senderProfile(message);
            return (
              <div key={message.id} className={isOwn ? styles.rowOwn : styles.rowOther}>
                {!isOwn ? (
                  <div className={styles.senderName}>{profile?.display_name || t('post.fallbackAuthor')}</div>
                ) : null}
                <div className={styles.bubbleWrap}>
                  <div className={isOwn ? styles.bubbleOwn : styles.bubbleOther}>{message.body}</div>
                  {!isOwn ? (
                    <button
                      type="button"
                      className={styles.reportBtn}
                      onClick={() => setReportTarget(message.id)}
                      aria-label={t('menu.report')}
                    >
                      ⋮
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
        <div ref={listEndRef} />
      </div>

      {errorMessage ? <p className={styles.errorMessage}>{errorMessage}</p> : null}

      <div className={postDetailStyles.commentInputRow}>
        <input
          className={postDetailStyles.commentInput}
          placeholder={t('companion.chat.placeholder')}
          value={body}
          maxLength={MAX_MESSAGE_LENGTH}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend();
          }}
        />
        <button
          type="button"
          className={postDetailStyles.commentSubmitBtn}
          disabled={sendMessage.isPending || !body.trim()}
          onClick={handleSend}
        >
          <Send size={16} aria-hidden="true" />
        </button>
      </div>

      {reportTarget ? (
        <ReportModal targetType="companion_message" targetId={reportTarget} onClose={() => setReportTarget(null)} />
      ) : null}
    </div>
  );
}
