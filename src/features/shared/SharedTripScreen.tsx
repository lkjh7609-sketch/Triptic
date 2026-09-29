import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { tripService } from '@/shared/api/tripService';
import { useSession } from '@/shared/hooks/useSession';
import { GlobalAuthModal } from '@/features/auth/GlobalAuthModal';
import { invalidateTripMembership } from '@/features/plan/hooks/useTrips';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { captureError, trackScreenView } from '@/shared/monitoring';
import { clearPendingShare, savePendingShare } from './pendingShare';
import styles from './SharedTripScreen.module.css';

/**
 * 공유 링크(/shared/:code) — 함께 편집할 사람으로 초대받아 들어오는 곳(0057).
 * 로그인 안 했으면 로그인 화면부터(닫을 수 없음). 로그인하면 이 여행의 편집 멤버가 되고
 * 바로 그 여행 화면(/plan/:id)으로 넘어가 소유자와 같은 화면에서 실시간으로 함께 고친다.
 * 예전의 로그인 없이 보는 읽기 전용 뷰어·장소 제안은 없어졌다.
 */
export function SharedTripScreen() {
  const { t } = useTranslation('community');
  const { code } = useParams<{ code: string }>();
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    trackScreenView('shared_trip_join');
  }, []);

  useEffect(() => {
    if (!loading && !user && code) savePendingShare(code);
  }, [loading, user, code]);

  const userId = user?.id;
  useEffect(() => {
    if (!userId || !code) return;
    let cancelled = false;
    tripService
      .joinTripByShareCode(code)
      .then((tripId) => {
        if (cancelled) return;
        clearPendingShare();
        if (!tripId) {
          setFailed(true);
          return;
        }
        invalidateTripMembership(queryClient);
        navigate(`/plan/${tripId}`, { replace: true });
      })
      .catch((err) => {
        if (cancelled) return;
        captureError(err, { context: 'joinTripByShareCode' });
        setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, code, navigate, queryClient]);

  if (loading) return <JoiningSkeleton />;

  if (!user) return <GlobalAuthModal notice={t('shared.loginNotice')} />;

  if (failed) {
    return (
      <div className={styles.joinScreen}>
        <ErrorState
          summary={t('shared.loadError')}
          retryLabel={t('shared.goToPlans')}
          onRetry={() => navigate('/plan', { replace: true })}
        />
      </div>
    );
  }

  return <JoiningSkeleton label={t('shared.joining')} />;
}

function JoiningSkeleton({ label }: { label?: string }) {
  return (
    <div className={styles.joinScreen} aria-busy="true">
      {label ? <p className={styles.joining}>{label}</p> : null}
      <Skeleton height="24px" width="60%" />
      <div style={{ height: 12 }} />
      <Skeleton height="88px" />
    </div>
  );
}
