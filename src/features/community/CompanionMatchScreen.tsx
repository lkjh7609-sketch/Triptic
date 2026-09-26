import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { MessageCircle, QrCode, ScanLine } from 'lucide-react';
import { useSession } from '@/shared/hooks/useSession';
import { captureError, trackScreenView } from '@/shared/monitoring';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { CompanionQrModal } from './CompanionQrModal';
import { CompanionScanModal } from './CompanionScanModal';
import { useCompanionMatchMembers, useCompanionPost, useWithdrawApplication } from './hooks/useCompanionPosts';
import postDetailStyles from './PostDetailScreen.module.css';
import styles from './CompanionMatchScreen.module.css';

/** 매칭 확정 후 멤버 목록 + QR 상호 검증(0032) */
export function CompanionMatchScreen() {
  const { t } = useTranslation(['community', 'common']);
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const { user } = useSession();
  const { data: post, isLoading, isError, refetch } = useCompanionPost(postId, user?.id ?? null);
  const membersQuery = useCompanionMatchMembers(post);
  const withdrawApplication = useWithdrawApplication(postId ?? '');
  const [showQr, setShowQr] = useState(false);
  const [showScan, setShowScan] = useState(false);

  useEffect(() => {
    trackScreenView('community_companion_match');
  }, []);

  if (isLoading) {
    return (
      <div style={{ padding: 16 }}>
        <Skeleton height="160px" />
      </div>
    );
  }
  if (isError || !post || post.status !== 'matched') {
    return <ErrorState summary={t('companion.match.loadError')} onRetry={() => refetch()} />;
  }

  const isOrganizer = !!user && user.id === post.author_id;
  const canLeave = !isOrganizer && post.myApplication?.status === 'accepted';

  async function handleLeave() {
    if (!post!.myApplication) return;
    if (!window.confirm(t('companion.match.leaveConfirm'))) return;
    try {
      await withdrawApplication.mutateAsync(post!.myApplication.id);
      navigate('/community');
    } catch (err) {
      captureError(err, { context: 'leaveCompanionMatch' });
    }
  }

  return (
    <div className={postDetailStyles.wrap}>
      <button type="button" className={postDetailStyles.backBtn} onClick={() => navigate(-1)}>
        ← {t('action.back', { ns: 'common' })}
      </button>

      <div className={postDetailStyles.post}>
        <h2 className={styles.title}>{post.title}</h2>
        <p className={styles.desc}>{t('companion.match.desc')}</p>

        <div className={styles.memberList}>
          {membersQuery.isLoading ? (
            <Skeleton height="80px" />
          ) : (
            (membersQuery.data ?? []).map((member) => (
              <div key={member.user_id} className={styles.memberRow}>
                {member.profile?.avatar_url ? (
                  <img src={member.profile.avatar_url} alt="" className={postDetailStyles.avatar} />
                ) : (
                  <span className={postDetailStyles.avatarFallback}>{(member.profile?.display_name ?? '?').slice(0, 1)}</span>
                )}
                <div>
                  <div className={postDetailStyles.authorName}>{member.profile?.display_name || t('post.fallbackAuthor')}</div>
                  {member.role === 'organizer' ? <span className={styles.organizerBadge}>{t('companion.match.organizer')}</span> : null}
                </div>
              </div>
            ))
          )}
        </div>

        <button type="button" className={styles.chatBtn} onClick={() => navigate(`/community/companion/${post.id}/chat`)}>
          <MessageCircle size={20} aria-hidden="true" />
          <span>{t('companion.chat.title')}</span>
        </button>

        <div className={styles.qrActions}>
          <button type="button" className={styles.qrActionBtn} onClick={() => setShowQr(true)}>
            <QrCode size={20} aria-hidden="true" />
            <span>{t('companion.qr.showTitle')}</span>
          </button>
          <button type="button" className={styles.qrActionBtn} onClick={() => setShowScan(true)}>
            <ScanLine size={20} aria-hidden="true" />
            <span>{t('companion.qr.scanTitle')}</span>
          </button>
        </div>

        {canLeave ? (
          <button type="button" className={styles.leaveBtn} disabled={withdrawApplication.isPending} onClick={handleLeave}>
            {t('companion.match.leave')}
          </button>
        ) : null}
      </div>

      {showQr ? <CompanionQrModal postId={post.id} onClose={() => setShowQr(false)} /> : null}
      {showScan ? <CompanionScanModal onClose={() => setShowScan(false)} /> : null}
    </div>
  );
}
