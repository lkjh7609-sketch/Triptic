import { useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Briefcase, Plane, Tent } from 'lucide-react';
import { useTrips } from '@/features/plan/hooks/useTrips';
import { getTripPhase } from '@/features/plan/tripStatus';
import { TripCard } from '@/features/plan/TripCard';
import { SAMPLE_TRIP_ID } from '@/features/plan/sampleTrip';
import { useSession } from '@/shared/hooks/useSession';
import { trackScreenView } from '@/shared/monitoring';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { HeroCard } from './HeroCard';
import { StatsTiles } from './StatsTiles';
import { WorldMapCard } from './WorldMapCard';
import { useHomeStats } from './useHomeStats';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { HomeDesktop } from './HomeDesktop';
import styles from './HomeScreen.module.css';

function noop() {}


/**
 * 홈 탭 — 여행 대시보드 (02-screens.md §2)
 * "내가 얼마나 여행했는가"를 보여주는 게 목적. 통계는 정규화 이관(M2~M4) 전까지
 * 임시 RPC(get_user_travel_stats_snapshot, useHomeStats.ts 참고)로 계산한다.
 */
export function HomeScreen() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const { t } = useTranslation('home');
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

  if (isDesktop) {
    return <HomeDesktop />;
  }

  if (sessionLoading) return null;

  // AppShell의 GlobalAuthModal에서 비로그인 사용자를 차단하므로 user는 항상 존재한다.
  if (!user) return null;

  if (tripsLoading) {
    return (
      <div className={styles.section}>
        <Skeleton height="120px" radius="var(--radius-lg)" />
        <div style={{ height: 12 }} />
        <Skeleton height="88px" radius="var(--radius-lg)" />
      </div>
    );
  }

  const displayName = user.user_metadata?.name ?? user.user_metadata?.full_name ?? t('greeting.fallbackName');
  const hasAnyTrip = (trips?.length ?? 0) > 0;
  const avatarUrl = user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=0D9488&color=fff`;

  return (
    <div className={styles.section}>
      <header className={styles.headerRow}>
        <div>
          <h1 className={styles.greeting}>{t('greeting.user', { name: displayName })}</h1>
          <p className={styles.subhead}>Where to next?</p>
        </div>
        <img src={avatarUrl} alt="User Avatar" className={styles.avatar} />
      </header>

      <div className={styles.quickCategories}>
        <a href="https://www.skyscanner.co.kr/" target="_blank" rel="noopener noreferrer" className={styles.categoryPill}><Plane size={16}/> {t('desktop.flights', { defaultValue: 'Flights' })}</a>
        <a href="https://www.agoda.com/" target="_blank" rel="noopener noreferrer" className={styles.categoryPill}><Briefcase size={16}/> {t('desktop.stays', { defaultValue: 'Stays' })}</a>
        <a href="https://www.klook.com/" target="_blank" rel="noopener noreferrer" className={styles.categoryPill}><Tent size={16}/> {t('desktop.activities', { defaultValue: 'Activities' })}</a>
      </div>

      {!hasAnyTrip ? (
        <EmptyState
          icon={<Briefcase size={48} />}
          message={t('empty.message')}
          actions={
            <div className={styles.onboardingActions}>
              <Link to="/plan" className={styles.onboardingLink}>
                {t('empty.createTrip')}
              </Link>
              <Link to={`/plan/${SAMPLE_TRIP_ID}`} className={styles.onboardingLink}>
                {t('empty.sampleTrip')}
              </Link>
            </div>
          }
        />
      ) : (
        <>
          <HeroCard ongoing={grouped.ongoing} upcoming={grouped.upcoming} />

          {stats.data ? (
            <>
              <h2 className={styles.sectionTitle}>{t('stats.sectionTitle')}</h2>
              <StatsTiles stats={stats.data} />
              <WorldMapCard countries={stats.data.countries} />
            </>
          ) : null}

          {grouped.past.length > 0 ? (
            <>
              <h2 className={styles.sectionTitle}>{t('past.sectionTitle')}</h2>
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
