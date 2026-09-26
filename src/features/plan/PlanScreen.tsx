import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useTrips, useRenameTrip, useDuplicateTrip, useDeleteTrip, tripQueryKey } from './hooks/useTrips';
import { getTripPhase } from './tripStatus';
import { SampleTripCard } from './SampleTripCard';
import { SAMPLE_TRIP_ID, resetSampleTrip } from './sampleTrip';
import { BackupModal } from './BackupModal';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { LoginButtons } from '@/features/auth/LoginButtons';
import { useSession } from '@/shared/hooks/useSession';
import { trackScreenView } from '@/shared/monitoring';
import styles from './PlanScreen.module.css';
import { Luggage } from 'lucide-react';
import { PlanDesktop } from './PlanDesktop';

/**
 * 계획 탭 — 여행 목록 + 개인 대시보드 (02-screens.md §3.1)
 * 화면 크기와 무관하게 PlanDesktop 레이아웃 하나를 쓴다(모바일도 responsive
 * CSS로 같은 마크업을 그대로 스택). 여행 상세·지도 뷰·서류 업로드는
 * 후속 작업(TripDetailScreen 등)에서 이어간다.
 */
export function PlanScreen() {
  const { t } = useTranslation(['plan', 'common']);
  const { user, loading: sessionLoading } = useSession();
  const queryClient = useQueryClient();
  const { data: trips, isLoading, isError, refetch } = useTrips();
  const renameTrip = useRenameTrip();
  const duplicateTrip = useDuplicateTrip();
  const deleteTrip = useDeleteTrip();
  const [showBackup, setShowBackup] = useState(false);

  const cardCallbacks = {
    onRename: (tripId: string, newTitle: string) => renameTrip.mutate({ tripId, newTitle }),
    onDuplicate: (tripId: string) => duplicateTrip.mutate(tripId),
    onDelete: (tripId: string) => deleteTrip.mutate(tripId),
  };

  useEffect(() => {
    trackScreenView('plan_trip_list');
  }, []);

  /** 비로그인 상태로 목록에 도착할 때마다 샘플 여행을 원본으로 리셋한다 — 둘러보다 만든
   * 변경은 저장되지 않고, 다시 열면 처음부터 시작한다 (index.html renderLobby 이식). */
  useEffect(() => {
    if (!sessionLoading && !user) {
      resetSampleTrip();
      queryClient.removeQueries({ queryKey: tripQueryKey(SAMPLE_TRIP_ID) });
    }
  }, [sessionLoading, user, queryClient]);

  const grouped = useMemo(() => {
    const list = trips ?? [];
    return {
      ongoing: list.filter((trip) => getTripPhase(trip.start_date, trip.end_date) === 'ongoing'),
      upcoming: list.filter((trip) => getTripPhase(trip.start_date, trip.end_date) === 'upcoming'),
      past: list.filter((trip) => getTripPhase(trip.start_date, trip.end_date) === 'past'),
    };
  }, [trips]);

  if (sessionLoading) return null;

  if (!user) {
    return (
      <div className={styles.section}>
        <EmptyState icon={<Luggage size={48} />} message={t('planScreen.loginMessage')} />
        <LoginButtons />
        <h2 className={styles.sectionTitle}>{t('planScreen.browseFirst')}</h2>
        <div className={styles.list}>
          <SampleTripCard />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.section}>
        <Skeleton height="88px" radius="var(--radius-lg)" />
        <div style={{ height: 12 }} />
        <Skeleton height="88px" radius="var(--radius-lg)" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.section}>
        <ErrorState summary={t('planScreen.listError')} onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <>
      <PlanDesktop
        trips={trips ?? []}
        ongoing={grouped.ongoing}
        upcoming={grouped.upcoming}
        past={grouped.past}
        onRefetch={refetch}
        onRename={cardCallbacks.onRename}
        onDuplicate={cardCallbacks.onDuplicate}
        onDelete={cardCallbacks.onDelete}
        onOpenBackup={() => setShowBackup(true)}
      />
      {showBackup ? (
        <BackupModal trips={trips ?? []} onClose={() => setShowBackup(false)} onImported={() => refetch()} />
      ) : null}
    </>
  );
}
