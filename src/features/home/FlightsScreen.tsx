import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plane, PlaneTakeoff } from 'lucide-react';
import { trackScreenView } from '@/shared/monitoring';
import { flightsProviderFor } from '@/features/plan/flightsSearchLink';
import { HomeSectionTabs } from './HomeSectionTabs';
import { MyrealtripFlightSearch } from './MyrealtripFlightSearch';
import { FlightsEssentials } from './FlightsEssentials';
import { FlightDeals } from './FlightDeals';
import { FlightThemes } from './FlightThemes';
import styles from './FlightsScreen.module.css';

/**
 * 항공 탭. 한국어는 마이리얼트립 검색 폼(결과는 마이리얼트립 사이트), 그 외 언어는 준비 중 안내 —
 * 트래블페이아웃 위젯을 2026-10-04에 뺐고, 새 항공 검색(Kayak 예정)이 이 자리에 들어온다.
 */
export function FlightsScreen() {
  const { t, i18n } = useTranslation('home');
  const provider = flightsProviderFor(i18n.language);

  useEffect(() => {
    trackScreenView('flights');
  }, []);

  return (
    <>
      <HomeSectionTabs />
      <div className={styles.wrap}>
        <header className={provider === 'myrealtrip' ? `${styles.header} ${styles.headerCompact}` : styles.header}>
          <h1 className={styles.title}>
            <Plane size={22} aria-hidden="true" /> {t('flights.title')}
          </h1>
          <p className={styles.subtitle}>{t('flights.subtitle')}</p>
        </header>
        {/* PC(1024px 이상)의 한국어 항공 탭은 큰 제목형 머리말 — 위 작은 머리말은 모바일에서만 */}
        {provider === 'myrealtrip' ? (
          <header className={styles.hero}>
            <span className={styles.badge}>
              <Plane size={14} aria-hidden="true" /> {t('flights.title')}
            </span>
            <h1 className={styles.heroTitle}>{t('flights.subtitle')}</h1>
            <p className={styles.lead}>{t('flights.lead')}</p>
          </header>
        ) : null}
        {provider === 'myrealtrip' ? (
          <>
            <MyrealtripFlightSearch />
            <FlightDeals />
            <FlightsEssentials />
            <FlightThemes />
          </>
        ) : (
          <section className={styles.comingSoon} aria-labelledby="flights-coming-soon">
            <span className={styles.comingSoonIcon} aria-hidden="true">
              <PlaneTakeoff size={24} />
            </span>
            <h2 id="flights-coming-soon" className={styles.comingSoonTitle}>
              {t('flights.comingSoon.title')}
            </h2>
            <p className={styles.comingSoonBody}>{t('flights.comingSoon.body')}</p>
          </section>
        )}
      </div>
    </>
  );
}
