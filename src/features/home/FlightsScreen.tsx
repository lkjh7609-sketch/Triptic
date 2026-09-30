import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plane } from 'lucide-react';
import { trackScreenView } from '@/shared/monitoring';
import { flightsProviderFor } from '@/features/plan/flightsSearchLink';
import { HomeSectionTabs } from './HomeSectionTabs';
import { MyrealtripFlightSearch } from './MyrealtripFlightSearch';
import { FlightsEssentials } from './FlightsEssentials';
import { FlightDeals } from './FlightDeals';
import { FlightThemes } from './FlightThemes';
import styles from './FlightsScreen.module.css';

/**
 * 항공 탭. 한국어는 마이리얼트립 검색 폼(결과는 마이리얼트립 사이트), 그 외 언어는
 * Travelpayouts 위젯 — 위젯은 AppShell의 FlightsWidgetHost가 이 화면 아래에 계속 붙여 둔다
 * (탭을 오갈 때마다 위젯을 새로 만들면 다시 그려지지 않아서).
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
        ) : null}
      </div>
    </>
  );
}
