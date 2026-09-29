import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { CheckCircle2, LogOut, QrCode, Receipt, Send } from 'lucide-react';
import { useSession } from '@/shared/hooks/useSession';
import { flagInvalid } from '@/shared/ui/invalidField';
import { captureError, trackScreenView } from '@/shared/monitoring';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { showToast } from '@/shared/ui/toast';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { AuthorName } from './AuthorName';
import { ReportModal } from './ReportModal';
import { CompanionReviewModal } from './CompanionReviewModal';
import {
  useCancelCompanionPost,
  useCompanionMatchMembers,
  useCompanionPost,
  useCompleteCompanionTrip,
  useMyCompanionCheckin,
  useWithdrawApplication,
} from './hooks/useCompanionPosts';
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
  const completeTrip = useCompleteCompanionTrip(postId ?? '');
  const withdrawApplication = useWithdrawApplication();
  const cancelPost = useCancelCompanionPost();
  const [confirmAction, setConfirmAction] = useState<'complete' | 'leave' | 'cancel' | null>(null);
  const [searchParams] = useSearchParams();
  // "내 동행"의 후기 남기기 카드는 ?review=1로 들어와 모달을 바로 연다
  const [showReview, setShowReview] = useState(searchParams.get('review') === '1');
  const checkinQuery = useMyCompanionCheckin(postId, user?.id, post?.status === 'closed');
  const needsReview = post?.status === 'closed' && checkinQuery.data === false;

  const [body, setBody] = useState('');
  const messageInputRef = useRef<HTMLInputElement>(null);
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
  // closed(일정 완료, 0046)도 읽기 전용으로 연다 — 지난 대화를 다시 볼 수 있어야 한다
  if (postError || !post || (post.status !== 'matched' && post.status !== 'closed')) {
    return <ErrorState summary={t('companion.match.loadError')} onRetry={() => refetch()} />;
  }

  const membersById = new Map((membersQuery.data ?? []).map((m) => [m.user_id, m.profile]));
  const isOrganizer = !!user && user.id === post.author_id;
  const isOpen = post.status === 'matched';
  // 시작 전 종료는 완료가 아니라 모임 취소(서버도 막는다)
  const canComplete = isOpen && isOrganizer && post.start_date <= format(new Date(), 'yyyy-MM-dd');
  const canLeave = isOpen && (isOrganizer || post.myApplication?.status === 'accepted');

  async function handleComplete() {
    try {
      await completeTrip.mutateAsync();
    } catch (err) {
      captureError(err, { context: 'completeCompanionTrip' });
      showToast(t('companion.chat.completeError'));
    }
  }

  async function handleLeave() {
    try {
      if (isOrganizer) {
        await cancelPost.mutateAsync(post!.id);
      } else if (post!.myApplication) {
        await withdrawApplication.mutateAsync(post!.myApplication.id);
      }
      navigate('/community', { replace: true });
    } catch (err) {
      captureError(err, { context: isOrganizer ? 'cancelCompanionMatch' : 'leaveCompanionMatch' });
    }
  }

  async function handleSend() {
    if (sendMessage.isPending) return;
    if (!body.trim()) {
      flagInvalid(messageInputRef.current);
      return;
    }
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
        {isOpen ? (
          <div className={styles.actions}>
            <button type="button" className={styles.actionBtn} onClick={() => navigate(`/community/companion/${post.id}/match`)}>
              <QrCode size={16} aria-hidden="true" /> {t('companion.chat.qrCheck')}
            </button>
            <button type="button" className={styles.actionBtn} onClick={() => navigate(`/community/companion/${post.id}/expenses`)}>
              <Receipt size={16} aria-hidden="true" /> {t('companion.expenses.button')}
            </button>
            {canComplete ? (
              <button type="button" className={styles.actionBtn} disabled={completeTrip.isPending} onClick={() => setConfirmAction('complete')}>
                <CheckCircle2 size={16} aria-hidden="true" /> {t('companion.chat.complete')}
              </button>
            ) : null}
            {canLeave ? (
              <button
                type="button"
                className={styles.actionBtnDanger}
                disabled={withdrawApplication.isPending || cancelPost.isPending}
                onClick={() => setConfirmAction(isOrganizer ? 'cancel' : 'leave')}
              >
                <LogOut size={16} aria-hidden="true" /> {isOrganizer ? t('companion.match.cancel') : t('companion.match.leave')}
              </button>
            ) : null}
          </div>
        ) : (
          <div className={styles.closedBanner}>
            <p className={styles.closedText}>{t('companion.chat.closedBanner')}</p>
            <div className={styles.actions}>
              <button type="button" className={styles.actionBtn} onClick={() => navigate(`/community/companion/${post.id}/expenses`)}>
                <Receipt size={16} aria-hidden="true" /> {t('companion.expenses.button')}
              </button>
              {needsReview ? (
                <button type="button" className={styles.actionBtn} onClick={() => setShowReview(true)}>
                  {t('companion.review.cta')}
                </button>
              ) : null}
            </div>
          </div>
        )}
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
                  <div className={styles.senderName}><AuthorName profile={profile} /></div>
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

      {isOpen ? (
      <div className={postDetailStyles.commentInputRow}>
        <input
          ref={messageInputRef}
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
          disabled={sendMessage.isPending}
          onClick={handleSend}
        >
          <Send size={16} aria-hidden="true" />
        </button>
      </div>
      ) : null}

      {reportTarget ? (
        <ReportModal targetType="companion_message" targetId={reportTarget} onClose={() => setReportTarget(null)} />
      ) : null}

      {showReview && needsReview ? <CompanionReviewModal post={post} onClose={() => setShowReview(false)} /> : null}

      {confirmAction === 'complete' ? (
        <ConfirmDialog
          title={t('companion.chat.complete')}
          message={t('companion.chat.completeConfirm')}
          cancelLabel={t('companion.chat.completeKeep')}
          confirmLabel={t('companion.chat.completeProceed')}
          onConfirm={handleComplete}
          onClose={() => setConfirmAction(null)}
        />
      ) : null}
      {confirmAction === 'leave' || confirmAction === 'cancel' ? (
        <ConfirmDialog
          title={t(`companion.match.${confirmAction}`)}
          message={t(`companion.match.${confirmAction}Confirm`)}
          cancelLabel={t(`companion.match.${confirmAction}Keep`)}
          confirmLabel={t(`companion.match.${confirmAction}Proceed`)}
          danger
          onConfirm={handleLeave}
          onClose={() => setConfirmAction(null)}
        />
      ) : null}
    </div>
  );
}
