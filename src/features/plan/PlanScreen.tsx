import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useTrips, useGuestTrips, useRenameTrip, useDuplicateTrip, useDeleteTrip, tripQueryKey } from './hooks/useTrips';
import { getTripPhase } from './tripStatus';
import { SAMPLE_TRIP_ID, getSampleTripRow, resetSampleTrip } from './sampleTrip';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { useSession } from '@/shared/hooks/useSession';
import { trackScreenView } from '@/shared/monitoring';
import styles from './PlanScreen.module.css';
import { PlanDesktop } from './PlanDesktop';

/**
 * 계획 탭 — 여행 목록 + 개인 대시보드 (02-screens.md §3.1)
 * 화면 크기와 무관하게 PlanDesktop 레이아웃 하나를 쓴다(모바일도 responsive
 * CSS로 같은 마크업을 그대로 스택). 여행 상세·지도 뷰·서류 업로드는
 * 후속 작업(TripDetailScreen 등)에서 이어간다.
 */
export function PlanScreen() {
  const { t, i18n } = useTranslation(['plan', 'common']);
  const { user, loading: sessionLoading } = useSession();
  const queryClient = useQueryClient();
  const { data: trips, isLoading, isError, refetch } = useTrips();
  const renameTrip = useRenameTrip();
  const duplicateTrip = useDuplicateTrip();
  const deleteTrip = useDeleteTrip();

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

  /** 비로그인은 샘플 여행 하나로 같은 대시보드를 그린다 — 도착할 때마다(언어가 바뀌어도) 원본으로 */
  const sampleTrips = useMemo(() => {
    if (sessionLoading || user) return [];
    resetSampleTrip();
    return [getSampleTripRow()];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 언어가 바뀌면 샘플을 그 언어로 다시 만든다
  }, [sessionLoading, user, i18n.language]);
  /** 로그인 전에 이 기기에 만든 임시 여행 — 샘플 위에 보인다 */
  const guestTrips = useGuestTrips();
  const list = useMemo(() => (user ? (trips ?? []) : [...guestTrips, ...sampleTrips]), [user, trips, guestTrips, sampleTrips]);

  const grouped = useMemo(() => {
    return {
      ongoing: list.filter((trip) => getTripPhase(trip.start_date, trip.end_date) === 'ongoing'),
      upcoming: list.filter((trip) => getTripPhase(trip.start_date, trip.end_date) === 'upcoming'),
      past: list.filter((trip) => getTripPhase(trip.start_date, trip.end_date) === 'past'),
    };
  }, [list]);

  if (sessionLoading) return null;

  if (!user) {
    // PC 비로그인 둘러보기 — 로그인한 화면과 같은 대시보드. 여행 만들기·편집만 로그인 창으로 막는다
    return (
      <PlanDesktop
        guest
        trips={list}
        ongoing={grouped.ongoing}
        upcoming={grouped.upcoming}
        past={grouped.past}
        onRefetch={refetch}
        onRename={cardCallbacks.onRename}
        onDuplicate={cardCallbacks.onDuplicate}
        onDelete={cardCallbacks.onDelete}
      />
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
    <PlanDesktop
      trips={list}
      ongoing={grouped.ongoing}
      upcoming={grouped.upcoming}
      past={grouped.past}
      onRefetch={refetch}
      onRename={cardCallbacks.onRename}
      onDuplicate={cardCallbacks.onDuplicate}
      onDelete={cardCallbacks.onDelete}
    />
  );
}
