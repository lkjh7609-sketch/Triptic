import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useTrips, useRenameTrip, useDuplicateTrip, useDeleteTrip, tripQueryKey } from './hooks/useTrips';
import { getTripPhase } from './tripStatus';
import { TripCard } from './TripCard';
import { SampleTripCard } from './SampleTripCard';
import { SAMPLE_TRIP_ID, resetSampleTrip } from './sampleTrip';
import { CreateTripModal } from './CreateTripModal';
import { BackupModal } from './BackupModal';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { LoginButtons } from '@/features/auth/LoginButtons';
import { useSession } from '@/shared/hooks/useSession';
import { trackScreenView } from '@/shared/monitoring';
import styles from './PlanScreen.module.css';

/**
 * 계획 탭 — 여행 목록 (02-screens.md §3.1)
 * 섹션: 진행 중 / 예정 / 지난 여행(접힘). 여행 상세·지도 뷰·서류 업로드는
 * 후속 작업(TripDetailScreen 등)에서 이어간다.
 */
export function PlanScreen() {
  const { t } = useTranslation(['plan', 'common']);
  void t; // TODO(Phase6-C 재개): 이 화면 본문 문자열 i18n 전환 미완료 — WIP 중단 지점
  const { user, loading: sessionLoading } = useSession();
  const queryClient = useQueryClient();
  const { data: trips, isLoading, isError, refetch } = useTrips();
  const renameTrip = useRenameTrip();
  const duplicateTrip = useDuplicateTrip();
  const deleteTrip = useDeleteTrip();
  const [showCreate, setShowCreate] = useState(false);
  const [showPast, setShowPast] = useState(false);
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
      ongoing: list.filter((t) => getTripPhase(t.start_date, t.end_date) === 'ongoing'),
      upcoming: list.filter((t) => getTripPhase(t.start_date, t.end_date) === 'upcoming'),
      past: list.filter((t) => getTripPhase(t.start_date, t.end_date) === 'past'),
    };
  }, [trips]);

  if (sessionLoading) return null;

  if (!user) {
    return (
      <div className={styles.section}>
        <EmptyState icon="🧳" message="로그인하면 내 여행을 저장하고 어디서든 이어갈 수 있어요." />
        <LoginButtons />
        <h2 className={styles.sectionTitle}>먼저 둘러보기</h2>
        <div className={styles.list}>
          <SampleTripCard />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.headerTitle}>내 여행</h1>
        <button
          type="button"
          className={styles.addButton}
          aria-label="여행 만들기"
          onClick={() => setShowCreate(true)}
        >
          +
        </button>
      </div>

      {isLoading ? (
        <div className={styles.section}>
          <Skeleton height="88px" radius="var(--radius-lg)" />
          <div style={{ height: 12 }} />
          <Skeleton height="88px" radius="var(--radius-lg)" />
        </div>
      ) : isError ? (
        <ErrorState summary="여행 목록을 불러오지 못했어요." onRetry={() => refetch()} />
      ) : (trips?.length ?? 0) === 0 ? (
        <div className={styles.section}>
          <EmptyState
            icon="🧳"
            message="첫 여행을 만들어 보세요."
            actions={
              <button type="button" className={styles.addButton} onClick={() => setShowCreate(true)}>
                +
              </button>
            }
          />
        </div>
      ) : (
        <>
          {grouped.ongoing.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>진행 중</h2>
              <div className={styles.list}>
                {grouped.ongoing.map((t) => (
                  <TripCard key={t.id} trip={t} {...cardCallbacks} />
                ))}
              </div>
            </section>
          )}

          {grouped.upcoming.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>예정</h2>
              <div className={styles.list}>
                {grouped.upcoming.map((t) => (
                  <TripCard key={t.id} trip={t} {...cardCallbacks} />
                ))}
              </div>
            </section>
          )}

          {grouped.past.length > 0 && (
            <section className={styles.section}>
              <button
                type="button"
                className={styles.pastToggle}
                onClick={() => setShowPast((v) => !v)}
              >
                지난 여행 {grouped.past.length}건 {showPast ? '숨기기 ▲' : '보기 ▼'}
              </button>
              {showPast ? (
                <div className={styles.list}>
                  {grouped.past.map((t) => (
                    <TripCard key={t.id} trip={t} {...cardCallbacks} />
                  ))}
                </div>
              ) : null}
            </section>
          )}
        </>
      )}

      {(trips?.length ?? 0) > 0 ? (
        <div className={styles.footer}>
          <button type="button" className={styles.footerButton} onClick={() => setShowBackup(true)}>
            ☁️ 기기 동기화 & 백업
          </button>
        </div>
      ) : null}

      {showCreate ? <CreateTripModal onClose={() => setShowCreate(false)} /> : null}

      {showBackup ? (
        <BackupModal trips={trips ?? []} onClose={() => setShowBackup(false)} onImported={() => refetch()} />
      ) : null}
    </div>
  );
}
