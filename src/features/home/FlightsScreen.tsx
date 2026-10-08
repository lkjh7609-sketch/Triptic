import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Plane } from 'lucide-react';
import { trackScreenView } from '@/shared/monitoring';
import { aiLocale } from '@/shared/api/aiCacheKeys';
import { flightFromParams, takeFlightsAutoSearch } from '@/features/plan/flightsAutoSearch';
import type { FlightSearch } from '@/features/plan/partnerLinks';
import { HomeSectionTabs } from './HomeSectionTabs';
import { MyrealtripFlightSearch } from './MyrealtripFlightSearch';
import { FlightResults } from './flights/FlightResults';
import { FlightsEssentials } from './FlightsEssentials';
import { FlightDeals } from './FlightDeals';
import { FlightThemes } from './FlightThemes';
import styles from './FlightsScreen.module.css';

/**
 * 항공 탭(모든 언어). 검색 폼 → 우리 화면 안의 운임 목록(정렬·필터), 예약만 예약 사이트(새 탭).
 * 한국어는 아래에 마이리얼트립 특가·유심 영역이 그대로 이어진다.
 * 일정·체크리스트에서 넘어오면 한 번만 바로 검색하고(flightsAutoSearch), 새로고침·뒤로 가기는 폼만 채운다 — 운임 검색은 유료 호출이라서.
 */
export function FlightsScreen() {
  const { t, i18n } = useTranslation('home');
  const isKo = aiLocale(i18n.language) === 'ko';
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState<FlightSearch | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    trackScreenView('flights');
  }, []);

  // 일정에서 넘어온 경우 한 번만 자동 검색(표시는 읽는 순간 지워진다)
  useEffect(() => {
    if (!takeFlightsAutoSearch()) return;
    const flight = flightFromParams(searchParams, format(new Date(), 'yyyy-MM-dd'));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (flight) setSearch(flight);
    // 처음 열릴 때만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function runSearch(next: FlightSearch) {
    setSearch(next);
    window.requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

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
        {/* PC(1024px 이상)는 큰 제목형 머리말 — 위 작은 머리말은 모바일에서만 */}
        <header className={styles.hero}>
          <span className={styles.badge}>
            <Plane size={14} aria-hidden="true" /> {t('flights.title')}
          </span>
          <h1 className={styles.heroTitle}>{t('flights.subtitle')}</h1>
          <p className={styles.lead}>{t('flights.lead')}</p>
        </header>
        <MyrealtripFlightSearch onSearch={runSearch} />
        <div ref={resultsRef} className={isKo ? styles.results : `${styles.results} ${styles.resultsLast}`}>
          {search ? <FlightResults search={search} /> : null}
        </div>
        {isKo ? (
          <>
            <FlightDeals />
            <FlightsEssentials />
            <FlightThemes />
          </>
        ) : null}
      </div>
    </>
  );
}
