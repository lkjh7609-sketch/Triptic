import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plane } from 'lucide-react';
import { trackScreenView } from '@/shared/monitoring';
import { flightsProviderFor } from '@/features/plan/flightsSearchLink';
import type { FlightSearch } from '@/features/plan/partnerLinks';
import { HomeSectionTabs } from './HomeSectionTabs';
import { MyrealtripFlightSearch } from './MyrealtripFlightSearch';
import { KayakFlightResults } from './KayakFlightResults';
import { FlightsEssentials } from './FlightsEssentials';
import { FlightDeals } from './FlightDeals';
import { FlightThemes } from './FlightThemes';
import styles from './FlightsScreen.module.css';

/**
 * 항공 탭. 한국어는 마이리얼트립 검색 폼(결과는 마이리얼트립 사이트), 그 외 언어는 같은 모양의 검색 폼 +
 * 우리 화면 안의 Kayak 결과 목록(예약은 Kayak 링크). 트래블페이아웃 위젯은 2026-10-04에 뺐다.
 */
export function FlightsScreen() {
  const { t, i18n } = useTranslation('home');
  const provider = flightsProviderFor(i18n.language);
  const [search, setSearch] = useState<FlightSearch | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  function runSearch(flight: FlightSearch) {
    setSearch(flight);
    // 결과가 폼 아래에 나오므로 모바일에서도 바로 보이게
    window.setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  useEffect(() => {
    trackScreenView('flights');
  }, []);

  return (
    <>
      <HomeSectionTabs />
      <div className={styles.wrap}>
        <header className={`${styles.header} ${styles.headerCompact}`}>
          <h1 className={styles.title}>
            <Plane size={22} aria-hidden="true" /> {t('flights.title')}
          </h1>
          <p className={styles.subtitle}>{t('flights.subtitle')}</p>
        </header>
        {/* PC(1024px 이상)의 항공 탭은 큰 제목형 머리말 — 위 작은 머리말은 모바일에서만 */}
        <header className={styles.hero}>
          <span className={styles.badge}>
            <Plane size={14} aria-hidden="true" /> {t('flights.title')}
          </span>
          <h1 className={styles.heroTitle}>{t('flights.subtitle')}</h1>
          <p className={styles.lead}>{t('flights.lead')}</p>
        </header>
        {provider === 'myrealtrip' ? (
          <>
            <MyrealtripFlightSearch />
            <FlightDeals />
            <FlightsEssentials />
            <FlightThemes />
          </>
        ) : (
          <>
            <MyrealtripFlightSearch kayak={{ onSearch: runSearch }} />
            <div ref={resultsRef}>{search ? <KayakFlightResults key={JSON.stringify(search)} search={search} /> : null}</div>
          </>
        )}
      </div>
    </>
  );
}
