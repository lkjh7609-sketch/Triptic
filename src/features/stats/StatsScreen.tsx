import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { BarChart3 } from 'lucide-react';
import { trackScreenView } from '@/shared/monitoring';
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
      ) : (
        <div className={styles.sections}>
          {stats.pastCount === 0 ? (
            // 다녀온 여행이 없어도 어떤 통계가 쌓이는지 보이도록 0건으로 다 보여 준다(2026-10-09 사용자 결정)
            <div className={styles.emptyBanner} role="status">
              <BarChart3 size={20} aria-hidden="true" />
              <div>
                <strong>{t('empty.title')}</strong>
                <span>{t('empty.body')}{stats.upcomingCount > 0 ? ` ${t('empty.upcoming', { count: stats.upcomingCount })}` : ''}</span>
              </div>
              <Link to="/plan" className={styles.bannerCta}>{t('empty.cta')}</Link>
            </div>
          ) : null}
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
