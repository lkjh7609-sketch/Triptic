import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Check, X as XIcon } from 'lucide-react';
import { useSession } from '@/shared/hooks/useSession';
import { trackScreenView, captureError } from '@/shared/monitoring';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { AuthorName } from './AuthorName';
import { PostActionsMenu } from './PostActionsMenu';
import { prefsLabel, sanitizeTags, spotsLeft } from './companionPrefs';
import { CompanionApplyModal } from './CompanionApplyModal';
import {
  useApplicationsForPost,
  useCancelCompanionPost,
  useCompanionPost,
  useFinalizeCompanionMatch,
  useRespondToApplication,
  useWithdrawApplication,
} from './hooks/useCompanionPosts';
import postDetailStyles from './PostDetailScreen.module.css';
import styles from './CompanionDetailScreen.module.css';
import { useRequireLogin } from '@/features/auth/loginPrompt';

export function CompanionDetailScreen() {
  const { t } = useTranslation(['community', 'common']);
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const { user } = useSession();

  const { data: post, isLoading, isError, refetch } = useCompanionPost(postId, user?.id ?? null);
  const isOwn = !!user && !!post && user.id === post.author_id;
  const applicationsQuery = useApplicationsForPost(isOwn ? postId : undefined);
  const respondToApplication = useRespondToApplication(postId ?? '');
  const withdrawApplication = useWithdrawApplication();
  const finalizeMatch = useFinalizeCompanionMatch(postId ?? '');
  const cancelPost = useCancelCompanionPost();
  const [showApplyModal, setShowApplyModal] = useState(false);
  const requireLogin = useRequireLogin();
  const [confirmAction, setConfirmAction] = useState<'cancel' | 'finalize' | 'withdraw' | null>(null);

  useEffect(() => {
    trackScreenView('community_companion_detail');
  }, []);

  if (isLoading) {
    return (
      <div style={{ padding: 16 }}>
        <Skeleton height="160px" />
      </div>
    );
  }
  if (isError || !post) {
    return <ErrorState summary={t('detail.loadError')} onRetry={() => refetch()} />;
  }

  const acceptedCount = (applicationsQuery.data ?? []).filter((a) => a.status === 'accepted').length;
  const pendingApplications = (applicationsQuery.data ?? []).filter((a) => a.status === 'pending');

  async function handleCancel() {
    try {
      await cancelPost.mutateAsync(post!.id);
      // 삭제와 같은 역할 — 동행 게시판으로 돌아가고, 기록을 바꿔치기해서 뒤로가기가 지운 글로 오지 않게 한다
      navigate('/community?tab=companion', { replace: true });
    } catch (err) {
      captureError(err, { context: 'cancelCompanionPost' });
    }
  }

  async function handleFinalize() {
    try {
      await finalizeMatch.mutateAsync();
      // 매칭 확정 = 채팅방 개설 — 주최자는 확정하자마자 바로 새 채팅방으로 들어간다.
      navigate(`/community/companion/${post!.id}/chat`);
    } catch (err) {
      captureError(err, { context: 'finalizeCompanionMatch' });
    }
  }

  async function handleWithdraw() {
    if (!post!.myApplication) return;
    try {
      await withdrawApplication.mutateAsync(post!.myApplication.id);
    } catch (err) {
      captureError(err, { context: 'withdrawCompanionApplication' });
    }
  }

  return (
    <div className={`${postDetailStyles.wrap} ${styles.page}`}>
      <button type="button" className={postDetailStyles.backBtn} onClick={() => navigate(-1)}>
        ← {t('action.back', { ns: 'common' })}
      </button>

      {post.status !== 'recruiting' && post.status !== 'matched' ? (
        <p className={postDetailStyles.statusNotice}>{t(`companion.detail.statusNotice.${post.status}`)}</p>
      ) : null}

      <div className={postDetailStyles.post}>
        <div className={postDetailStyles.header}>
          <div className={postDetailStyles.author} onClick={() => navigate(`/community/user/${post.author_id}`)}>
            {post.author?.avatar_url ? (
              <img src={post.author.avatar_url} alt="" className={postDetailStyles.avatar} />
            ) : (
              <span className={postDetailStyles.avatarFallback}>{(post.author?.display_name ?? '?').slice(0, 1)}</span>
            )}
            <div>
              <div className={postDetailStyles.authorName}><AuthorName profile={post.author} /></div>
              <div className={postDetailStyles.time}>{post.destination?.name ?? t('companion.detail.anyDestination')}</div>
            </div>
          </div>
          {!isOwn ? (
            <PostActionsMenu
              targetType="companion_post"
              targetId={post.id}
              authorId={post.author_id}
              onReported={() => navigate('/community', { replace: true })}
            />
          ) : null}
        </div>

        <h2 className={styles.title}>{post.title}</h2>
        <div className={styles.meta}>
          <span>{post.start_date && post.end_date ? t('companion.detail.dateRange', { start: post.start_date, end: post.end_date }) : t('companion.detail.dateTbd')}</span>
          <span>{t('companion.detail.groupSize', { count: spotsLeft(post) })}</span>
          {prefsLabel(post, t) ? <span>{prefsLabel(post, t)}</span> : null}
        </div>
        {sanitizeTags(post.tags).length > 0 ? (
          <div className={styles.meta}>
            {sanitizeTags(post.tags).map((tag) => (
              <span key={tag}>#{t(`companion.tags.${tag}`)}</span>
            ))}
          </div>
        ) : null}
        <p className={postDetailStyles.body}>{post.body}</p>

        {isOwn ? (
          <div className={styles.ownerActions}>
            {post.status === 'recruiting' ? (
              <>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  disabled={acceptedCount === 0 || finalizeMatch.isPending}
                  onClick={() => setConfirmAction('finalize')}
                >
                  {t('companion.detail.finalize', { count: acceptedCount })}
                </button>
                <button type="button" className={styles.dangerBtn} disabled={cancelPost.isPending} onClick={() => setConfirmAction('cancel')}>
                  {t('companion.detail.cancel')}
                </button>
              </>
            ) : post.status === 'matched' ? (
              <>
                <button type="button" className={styles.primaryBtn} onClick={() => navigate(`/community/companion/${post.id}/chat`)}>
                  {t('companion.chat.title')}
                </button>
                <button type="button" className={styles.primaryBtn} onClick={() => navigate(`/community/companion/${post.id}/match`)}>
                  {t('companion.detail.goToMatch')}
                </button>
              </>
            ) : post.status === 'closed' ? (
              <button type="button" className={styles.primaryBtn} onClick={() => navigate(`/community/companion/${post.id}/chat`)}>
                {t('companion.chat.title')}
              </button>
            ) : null}
          </div>
        ) : post.myApplication ? (
          <div className={styles.ownerActions}>
            <span className={styles.applicationStatus}>{t(`companion.detail.myApplicationStatus.${post.myApplication.status}`)}</span>
            {post.myApplication.status === 'pending' || post.myApplication.status === 'accepted' ? (
              <button type="button" className={styles.dangerBtn} disabled={withdrawApplication.isPending} onClick={() => setConfirmAction('withdraw')}>
                {t('companion.detail.withdraw')}
              </button>
            ) : null}
            {post.myApplication.status === 'accepted' && post.status === 'matched' ? (
              <>
                <button type="button" className={styles.primaryBtn} onClick={() => navigate(`/community/companion/${post.id}/chat`)}>
                  {t('companion.chat.title')}
                </button>
                <button type="button" className={styles.primaryBtn} onClick={() => navigate(`/community/companion/${post.id}/match`)}>
                  {t('companion.detail.goToMatch')}
                </button>
              </>
            ) : null}
            {post.myApplication.status === 'accepted' && post.status === 'closed' ? (
              <button type="button" className={styles.primaryBtn} onClick={() => navigate(`/community/companion/${post.id}/chat`)}>
                {t('companion.chat.title')}
              </button>
            ) : null}
            {/* 자동 검열로 막힌 지원은 문구를 고쳐 다시 지원할 수 있다(0044) */}
            {post.myApplication.status === 'removed' && post.status === 'recruiting' ? (
              <button type="button" className={styles.primaryBtn} onClick={() => setShowApplyModal(true)}>
                {t('companion.detail.apply')}
              </button>
            ) : null}
          </div>
        ) : post.status === 'recruiting' ? (
          <div className={styles.ownerActions}>
            <button type="button" className={styles.primaryBtn} onClick={() => requireLogin() && setShowApplyModal(true)}>
              {t('companion.detail.apply')}
            </button>
          </div>
        ) : null}
      </div>

      {isOwn && post.status === 'recruiting' ? (
        <div className={styles.applicantList}>
          <h3 className={styles.applicantListTitle}>{t('companion.detail.applicants', { count: pendingApplications.length })}</h3>
          {applicationsQuery.isLoading ? (
            <Skeleton height="80px" />
          ) : pendingApplications.length === 0 ? (
            <EmptyState message={t('companion.detail.noApplicants')} />
          ) : (
            pendingApplications.map((app) => (
              <div key={app.id} className={styles.applicantRow}>
                <div className={postDetailStyles.author}>
                  {app.applicant?.avatar_url ? (
                    <img src={app.applicant.avatar_url} alt="" className={postDetailStyles.avatar} />
                  ) : (
                    <span className={postDetailStyles.avatarFallback}>{(app.applicant?.display_name ?? '?').slice(0, 1)}</span>
                  )}
                  <div>
                    <div className={postDetailStyles.authorName}><AuthorName profile={app.applicant} /></div>
                    {app.message ? <p className={styles.applicantMessage}>{app.message}</p> : null}
                  </div>
                </div>
                <div className={styles.applicantActions}>
                  <button
                    type="button"
                    className={styles.acceptBtn}
                    disabled={respondToApplication.isPending}
                    onClick={() => respondToApplication.mutate({ applicationId: app.id, accept: true })}
                    aria-label={t('companion.detail.accept')}
                  >
                    <Check size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={styles.rejectBtn}
                    disabled={respondToApplication.isPending}
                    onClick={() => respondToApplication.mutate({ applicationId: app.id, accept: false })}
                    aria-label={t('companion.detail.reject')}
                  >
                    <XIcon size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}

      {showApplyModal ? <CompanionApplyModal postId={post.id} onClose={() => setShowApplyModal(false)} /> : null}

      {confirmAction === 'cancel' ? (
        <ConfirmDialog
          title={t('companion.detail.cancel')}
          message={t('companion.detail.cancelConfirm')}
          cancelLabel={t('companion.detail.cancelKeep')}
          confirmLabel={t('companion.detail.cancelProceed')}
          danger
          onConfirm={handleCancel}
          onClose={() => setConfirmAction(null)}
        />
      ) : null}
      {confirmAction === 'finalize' ? (
        <ConfirmDialog
          title={t('companion.detail.finalize', { count: acceptedCount })}
          message={t('companion.detail.finalizeConfirm')}
          cancelLabel={t('companion.detail.finalizeKeep')}
          confirmLabel={t('companion.detail.finalizeProceed')}
          onConfirm={handleFinalize}
          onClose={() => setConfirmAction(null)}
        />
      ) : null}
      {confirmAction === 'withdraw' ? (
        <ConfirmDialog
          title={t('companion.detail.withdraw')}
          message={t('companion.detail.withdrawConfirm')}
          cancelLabel={t('companion.detail.withdrawKeep')}
          confirmLabel={t('companion.detail.withdrawProceed')}
          danger
          onConfirm={handleWithdraw}
          onClose={() => setConfirmAction(null)}
        />
      ) : null}
    </div>
  );
}
