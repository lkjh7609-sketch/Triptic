import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { BarChart3 } from 'lucide-react';
import { trackScreenView } from '@/shared/monitoring';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { useTravelStats } from './useTravelStats';
import { BadgesSection, ExpenseSection, HabitsSection, SummaryStrip, TripsSection, WorldSection } from './StatsSections';
import styles from './Stats.module.css';

/** 통계 탭 — 지금까지 다녀온 여행(종료일이 지난 여행)의 모든 통계. 비로그인은 AppShell이 로그인 창을 먼저 띄운다(guestAccess) */
export function StatsScreen() {
  const { t } = useTranslation('stats');
  const { stats, isLoading, isError, refetch } = useTravelStats();
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    trackScreenView('stats');
  }, []);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>{t('title')}</h1>
        <p className={styles.subtitle}>{t('subtitle')}</p>
      </header>

      {isError ? (
        <ErrorState summary={t('loadError')} onRetry={refetch} />
      ) : isLoading || !stats ? (
        <div className={styles.sections}>
          <Skeleton height="120px" />
          <Skeleton height="260px" />
          <Skeleton height="260px" />
        </div>
      ) : stats.pastCount === 0 ? (
        <EmptyState
          icon={<BarChart3 size={32} aria-hidden="true" />}
          message={`${t('empty.title')} ${t('empty.body')}${stats.upcomingCount > 0 ? ` ${t('empty.upcoming', { count: stats.upcomingCount })}` : ''}`}
          actions={
            <Link to="/plan" className={styles.cta}>
              {t('empty.cta')}
            </Link>
          }
        />
      ) : (
        <div className={styles.sections}>
          <SummaryStrip stats={stats} />
          <WorldSection stats={stats} />
          <ExpenseSection stats={stats} />
          <HabitsSection stats={stats} />
          <TripsSection trips={stats.trips} expanded={expanded} onToggle={(id) => setExpanded((cur) => (cur === id ? null : id))} />
          <BadgesSection badges={stats.badges} />
        </div>
      )}
    </div>
  );
}
