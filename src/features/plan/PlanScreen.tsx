import { useEffect, useMemo, useState } from 'react';
import { useTrips, useRenameTrip, useDuplicateTrip, useDeleteTrip } from './hooks/useTrips';
import { getTripPhase } from './tripStatus';
import { TripCard } from './TripCard';
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
  const { user, loading: sessionLoading } = useSession();
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
