import { useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import { useTrips } from '@/features/plan/hooks/useTrips';
import { getTripPhase } from '@/features/plan/tripStatus';
import { TripCard } from '@/features/plan/TripCard';
import { SAMPLE_TRIP_ID } from '@/features/plan/sampleTrip';
import { useSession } from '@/shared/hooks/useSession';
import { LoginButtons } from '@/features/auth/LoginButtons';
import { trackScreenView } from '@/shared/monitoring';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { HeroCard } from './HeroCard';
import { StatsTiles } from './StatsTiles';
import { WorldMapCard } from './WorldMapCard';
import { useHomeStats, type TravelStats } from './useHomeStats';
import styles from './HomeScreen.module.css';

function noop() {}

const DEMO_STATS: TravelStats = {
  tripCount: 12,
  countryCount: 7,
  cityCount: 23,
  dayCount: 48,
  placeCount: 186,
  groundMeters: 1_200_000,
  countries: ['Japan', 'France', 'United States', 'Thailand', 'Italy', 'Spain', 'Vietnam'],
};

/**
 * 홈 탭 — 여행 대시보드 (02-screens.md §2)
 * "내가 얼마나 여행했는가"를 보여주는 게 목적. 통계는 정규화 이관(M2~M4) 전까지
 * 임시 RPC(get_user_travel_stats_snapshot, useHomeStats.ts 참고)로 계산한다.
 */
export function HomeScreen() {
  const { user, loading: sessionLoading } = useSession();
  const { data: trips, isLoading: tripsLoading } = useTrips();
  const stats = useHomeStats();

  useEffect(() => {
    trackScreenView('home');
  }, []);

  const grouped = useMemo(() => {
    const list = trips ?? [];
    const ongoing = list.find((t) => getTripPhase(t.start_date, t.end_date) === 'ongoing');
    const upcoming = list
      .filter((t) => getTripPhase(t.start_date, t.end_date) === 'upcoming')
      .sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''))[0];
    const past = list
      .filter((t) => getTripPhase(t.start_date, t.end_date) === 'past')
      .sort((a, b) => (b.end_date ?? '').localeCompare(a.end_date ?? ''));
    return { ongoing, upcoming, past };
  }, [trips]);

  if (sessionLoading) return null;

  // §2.3 "비로그인: 샘플 데이터로 통계 미리보기 + 흐림 처리 + 로그인하고 내 기록 보기"
  if (!user) {
    return (
      <div className={styles.section}>
        <h1 className={styles.greeting}>안녕하세요 👋</h1>
        <div className={styles.blurWrap}>
          <div className={styles.blurContent} aria-hidden="true">
            <StatsTiles stats={DEMO_STATS} />
          </div>
          <div className={styles.blurOverlay}>
            <p className={styles.blurMessage}>로그인하고 내 기록을 확인해 보세요</p>
          </div>
        </div>
        <LoginButtons />
      </div>
    );
  }

  if (tripsLoading) {
    return (
      <div className={styles.section}>
        <Skeleton height="120px" radius="var(--radius-lg)" />
        <div style={{ height: 12 }} />
        <Skeleton height="88px" radius="var(--radius-lg)" />
      </div>
    );
  }

  const displayName = user.user_metadata?.name ?? user.user_metadata?.full_name ?? '여행자';
  const hasAnyTrip = (trips?.length ?? 0) > 0;

  return (
    <div className={styles.section}>
      <h1 className={styles.greeting}>안녕하세요, {displayName}님 👋</h1>

      {!hasAnyTrip ? (
        <EmptyState
          icon="🧳"
          message="아직 떠난 여행이 없어요. 첫 여행을 기록해 볼까요?"
          actions={
            <div className={styles.onboardingActions}>
              <Link to="/plan" className={styles.onboardingLink}>
                + 여행 만들기
              </Link>
              <Link to={`/plan/${SAMPLE_TRIP_ID}`} className={styles.onboardingLink}>
                ✨ 샘플 여행 둘러보기
              </Link>
            </div>
          }
        />
      ) : (
        <>
          <HeroCard ongoing={grouped.ongoing} upcoming={grouped.upcoming} />

          {stats.data ? (
            <>
              <h2 className={styles.sectionTitle}>나의 여행 기록</h2>
              <StatsTiles stats={stats.data} />
              <WorldMapCard countries={stats.data.countries} />
            </>
          ) : null}

          {grouped.past.length > 0 ? (
            <>
              <h2 className={styles.sectionTitle}>지난 여행</h2>
              <div className={styles.pastScroll}>
                {grouped.past.map((t) => (
                  <div key={t.id} className={styles.pastCard}>
                    <TripCard trip={t} showMenu={false} onRename={noop} onDuplicate={noop} onDelete={noop} />
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
