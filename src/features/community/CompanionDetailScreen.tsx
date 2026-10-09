import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { DATE_FNS_LOCALE } from '@/features/plan/planDateFormat';
import { CalendarDays, Check, ChevronLeft, MapPin, Share2, UserRound, Users, X as XIcon } from 'lucide-react';
import { useSession } from '@/shared/hooks/useSession';
import { trackScreenView, captureError } from '@/shared/monitoring';
import { showToast } from '@/shared/ui/toast';
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
import postStyles from './PostDetailPage.module.css';
import styles from './CompanionDetailScreen.module.css';
import { useRequireLogin } from '@/features/auth/loginPrompt';

/** 일반 게시글 상세와 같은 모양의 작은 프로필 사진 */
function Avatar({ url, name, size }: { url?: string | null; name?: string | null; size: number }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  return url ? (
    <img src={url} alt="" className={postStyles.avatar} style={{ width: size, height: size }} />
  ) : (
    <span className={postStyles.avatarFallback} style={{ width: size, height: size }} aria-hidden="true">
      {initial}
    </span>
  );
}

export function CompanionDetailScreen() {
  const { t, i18n } = useTranslation(['community', 'common']);
  const dfLocale = DATE_FNS_LOCALE[i18n.language] ?? DATE_FNS_LOCALE.ko;
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

  async function handleShare() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: post!.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      showToast(t('detail.shareCopied'), { tone: 'success' });
    } catch (err) {
      // 공유 창을 닫은 것은 오류가 아니다
      if (err instanceof DOMException && err.name === 'AbortError') return;
      showToast(t('detail.shareFailed'), { tone: 'error' });
    }
  }

  const tags = sanitizeTags(post.tags);
  const prefs = prefsLabel(post, t);
  const destinationName = post.destination?.name ?? t('companion.detail.anyDestination');
  const created = new Date(post.created_at);
  const shortDay = (ymd: string) => format(new Date(`${ymd}T00:00:00`), 'MM.dd');
  const dates = post.start_date && post.end_date ? t('companion.detail.dateRange', { start: shortDay(post.start_date), end: shortDay(post.end_date) }) : t('companion.detail.dateTbd');

  return (
    <div className={postStyles.page}>
      <nav className={postStyles.crumbs} aria-label="breadcrumb">
        <button type="button" className={postStyles.backBtn} onClick={() => navigate(-1)}>
          <ChevronLeft size={16} aria-hidden="true" /> {t('action.back', { ns: 'common' })}
        </button>
        <span className={postStyles.crumbSep} aria-hidden="true">/</span>
        <Link to="/community" className={postStyles.crumbLink}>
          {t('detail.breadcrumbCommunity')}
        </Link>
        <span className={postStyles.crumbSep} aria-hidden="true">/</span>
        <Link to="/community?tab=companion" className={postStyles.crumbLink}>
          {t('channel.tabCompanion')}
        </Link>
      </nav>

      {post.status !== 'recruiting' && post.status !== 'matched' ? (
        <p className={postStyles.statusNotice}>{t(`companion.detail.statusNotice.${post.status}`)}</p>
      ) : null}

      <article className={postStyles.card}>
        <div className={postStyles.chips}>
          <span className={postStyles.chip}>{`${destinationName} · ${t('channel.tabCompanion')}`}</span>
          {post.status === 'recruiting' || post.status === 'matched' ? (
            <span className={post.status === 'recruiting' ? styles.statusOpen : styles.statusMatched}>{t(`companion.detail.statusChip.${post.status}`)}</span>
          ) : null}
        </div>

        <h1 className={postStyles.title}>{post.title}</h1>

        <div className={postStyles.authorRow}>
          <button type="button" className={postStyles.author} onClick={() => navigate(`/community/user/${post.author_id}`)}>
            <span className={postStyles.avatarWrap}>
              <Avatar url={post.author?.avatar_url} name={post.author?.display_name} size={44} />
            </span>
            <span className={postStyles.authorText}>
              <span className={postStyles.authorName}>
                <AuthorName profile={post.author} />
                <span className={postStyles.authorBadge}>{t('detail.authorBadge')}</span>
              </span>
              <span className={postStyles.meta}>
                {formatDistanceToNowStrict(created, { addSuffix: true, locale: dfLocale })} ({format(created, 'yyyy.MM.dd')})
              </span>
            </span>
          </button>
          <div className={postStyles.topActions}>
            <button type="button" className={postStyles.iconBtn} onClick={handleShare} aria-label={t('detail.share')}>
              <Share2 size={18} aria-hidden="true" />
            </button>
            {!isOwn ? (
              <PostActionsMenu
                targetType="companion_post"
                targetId={post.id}
                authorId={post.author_id}
                onReported={() => navigate('/community', { replace: true })}
              />
            ) : null}
          </div>
        </div>

        <hr className={postStyles.rule} />

        {/* 동행글만의 요약 — 목적지·일정·남은 자리·원하는 동행 */}
        <dl className={styles.facts}>
          <div className={styles.fact}>
            <dt>
              <MapPin size={15} aria-hidden="true" /> {t('companion.detail.factDestination')}
            </dt>
            <dd>{destinationName}</dd>
          </div>
          <div className={styles.fact}>
            <dt>
              <CalendarDays size={15} aria-hidden="true" /> {t('companion.detail.factDates')}
            </dt>
            <dd>{dates}</dd>
          </div>
          <div className={styles.fact}>
            <dt>
              <Users size={15} aria-hidden="true" /> {t('companion.detail.factSpots')}
            </dt>
            <dd>
              {t('companion.detail.groupSize', { count: spotsLeft(post) })}
              <span className={styles.dot} aria-hidden="true">
                ·
              </span>
              {t('companion.detail.groupTotal', { count: post.group_size })}
            </dd>
          </div>
          {prefs ? (
            <div className={styles.fact}>
              <dt>
                <UserRound size={15} aria-hidden="true" /> {t('companion.detail.factPrefs')}
              </dt>
              <dd>{prefs}</dd>
            </div>
          ) : null}
        </dl>

        <p className={`${postStyles.bodyRich} ${styles.body}`}>{post.body}</p>

        {tags.length > 0 ? (
          <div className={postStyles.tagRow}>
            {tags.map((tag) => (
              <span key={tag} className={postStyles.tagChip}>
                #{t(`companion.tags.${tag}`)}
              </span>
            ))}
          </div>
        ) : null}

        <hr className={postStyles.rule} />

        {/* 하단 행동 줄 — 글쓴이는 모집 관리, 지원자는 지원·진행 상태(공유는 위 아이콘) */}
        <div className={styles.actionBar}>
          <div className={styles.ctaGroup}>
            {isOwn ? (
              post.status === 'recruiting' ? (
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
                  <button type="button" className={postStyles.pillBtn} onClick={() => navigate(`/community/companion/${post.id}/match`)}>
                    {t('companion.detail.goToMatch')}
                  </button>
                </>
              ) : post.status === 'closed' ? (
                <button type="button" className={styles.primaryBtn} onClick={() => navigate(`/community/companion/${post.id}/chat`)}>
                  {t('companion.chat.title')}
                </button>
              ) : null
            ) : post.myApplication ? (
              <>
                {/* 매칭 확정 뒤(진행·완료)에는 '수락됨' 칩과 '지원 취소'를 숨긴다 — 채팅방 버튼이 곧 수락된 표시이고,
                    나가기는 매칭 화면의 '그룹 나가기'(같은 withdraw 호출)로 한다. 폰에서도 버튼이 한 줄에 든다(2026-10-09 사용자 결정) */}
                {!(post.myApplication.status === 'accepted' && (post.status === 'matched' || post.status === 'closed')) ? (
                  <span className={styles.applicationStatus}>{t(`companion.detail.myApplicationStatus.${post.myApplication.status}`)}</span>
                ) : null}
                {post.myApplication.status === 'accepted' && post.status === 'matched' ? (
                  <>
                    <button type="button" className={styles.primaryBtn} onClick={() => navigate(`/community/companion/${post.id}/chat`)}>
                      {t('companion.chat.title')}
                    </button>
                    <button type="button" className={postStyles.pillBtn} onClick={() => navigate(`/community/companion/${post.id}/match`)}>
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
                {post.myApplication.status === 'pending' || (post.myApplication.status === 'accepted' && post.status === 'recruiting') ? (
                  <button type="button" className={styles.dangerBtn} disabled={withdrawApplication.isPending} onClick={() => setConfirmAction('withdraw')}>
                    {t('companion.detail.withdraw')}
                  </button>
                ) : null}
              </>
            ) : post.status === 'recruiting' ? (
              <button type="button" className={styles.primaryBtn} onClick={() => requireLogin() && setShowApplyModal(true)}>
                {t('companion.detail.apply')}
              </button>
            ) : null}
          </div>
        </div>
      </article>

      {isOwn && post.status === 'recruiting' ? (
        <section className={postStyles.card} aria-labelledby="companion-applicants-title">
          <h2 id="companion-applicants-title" className={styles.applicantListTitle}>
            {t('companion.detail.applicants', { count: pendingApplications.length })}
          </h2>
          {applicationsQuery.isLoading ? (
            <Skeleton height="80px" />
          ) : pendingApplications.length === 0 ? (
            <EmptyState message={t('companion.detail.noApplicants')} />
          ) : (
            pendingApplications.map((app) => (
              <div key={app.id} className={styles.applicantRow}>
                <div className={styles.applicant}>
                  <Avatar url={app.applicant?.avatar_url} name={app.applicant?.display_name} size={40} />
                  <div className={postStyles.authorText}>
                    <div className={postStyles.authorName}>
                      <AuthorName profile={app.applicant} />
                    </div>
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
        </section>
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
