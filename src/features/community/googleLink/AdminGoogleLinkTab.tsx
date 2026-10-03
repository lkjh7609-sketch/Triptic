import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import styles from '../AdminScreen.module.css';
import { linkDestinations, type LinkOutcome } from './googleLinkRunner';
import { loadLinkOverview, saveGooglePlaceId, searchGooglePlaces } from './googleLinkService';

/**
 * 운영 콘솔 'Google 연동' — 여행지마다 구글 지도의 그 도시 장소 ID를 찾아 저장한다(0079 google_place_id).
 * 앱의 구글 키는 웹사이트 주소로만 쓸 수 있어 서버에서 일괄 조회할 수 없기 때문에, 관리자가 이 화면에서 한 번 눌러 브라우저로 돌린다.
 * 우리 좌표에서 가까운 도시 단위 장소가 잡히면 자동으로 저장하고, 멀거나 없는 곳은 아래에 모아 두고 직접 정한다.
 */
export function AdminGoogleLinkTab() {
  const { t } = useTranslation('community');
  const queryClient = useQueryClient();
  const overview = useQuery({
    queryKey: ['admin', 'google-link'],
    queryFn: loadLinkOverview,
    staleTime: 0,
  });
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [review, setReview] = useState<LinkOutcome[]>([]);
  const stopRef = useRef(false);

  async function start() {
    const pending = overview.data?.pending ?? [];
    if (pending.length === 0 || running) return;
    stopRef.current = false;
    setRunning(true);
    setReview([]);
    try {
      await linkDestinations(pending, {
        search: searchGooglePlaces,
        save: (target, placeId) => saveGooglePlaceId(target.id, placeId),
        shouldStop: () => stopRef.current,
        onProgress: (outcome, done, total) => {
          setProgress({ done, total });
          if (outcome.result.status !== 'matched' || outcome.error)
            setReview((prev) => [...prev, outcome]);
        },
      });
    } finally {
      setRunning(false);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'google-link'] });
    }
  }

  async function accept(outcome: LinkOutcome) {
    const placeId = outcome.result.candidate?.placeId;
    if (!placeId) return;
    await saveGooglePlaceId(outcome.target.id, placeId);
    setReview((prev) => prev.filter((o) => o.target.id !== outcome.target.id));
    await queryClient.invalidateQueries({ queryKey: ['admin', 'google-link'] });
  }

  if (overview.isLoading) return <Skeleton height="120px" />;
  if (overview.isError || !overview.data)
    return (
      <ErrorState summary={t('admin.googleLink.loadError')} onRetry={() => overview.refetch()} />
    );
  const { pending, linked, total } = overview.data;

  return (
    <div className={styles.list}>
      <div className={styles.item}>
        <p className={styles.preview}>{t('admin.googleLink.summary', { linked, total })}</p>
        <p className={styles.tripUsage}>{t('admin.googleLink.hint')}</p>
        <div className={styles.userRow}>
          <button
            type="button"
            className={styles.secondaryBtn}
            disabled={running || pending.length === 0}
            onClick={start}
          >
            {pending.length === 0
              ? t('admin.googleLink.allDone')
              : t('admin.googleLink.start', { count: pending.length })}
          </button>
          {running ? (
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => (stopRef.current = true)}
            >
              {t('admin.googleLink.stop')}
            </button>
          ) : null}
        </div>
        {progress ? (
          <p className={styles.tripUsage} role="status">
            {t('admin.googleLink.progress', { done: progress.done, total: progress.total })}
          </p>
        ) : null}
      </div>

      {review.length > 0 ? (
        <div className={styles.item}>
          <p className={styles.preview}>
            {t('admin.googleLink.reviewTitle', { count: review.length })}
          </p>
          {review.map((o) => (
            <div key={o.target.id} className={styles.userRow}>
              <div className={styles.userInfo}>
                <span className={styles.userHandle}>
                  {o.target.nameEn} ({o.target.slug})
                </span>
                <span className={styles.userName}>
                  {o.error
                    ? t('admin.googleLink.error', { message: o.error })
                    : o.result.status === 'far'
                      ? t('admin.googleLink.far', {
                          name: o.result.candidate?.name,
                          km: o.result.distanceKm,
                        })
                      : t('admin.googleLink.none')}
                </span>
              </div>
              {o.result.candidate && !o.error ? (
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => void accept(o)}
                >
                  {t('admin.googleLink.accept')}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
