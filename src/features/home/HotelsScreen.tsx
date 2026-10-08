import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { BedDouble } from 'lucide-react';
import { trackScreenView } from '@/shared/monitoring';
import { isNativeApp } from '@/shared/platform';
import { HomeSectionTabs } from './HomeSectionTabs';
import { HotelSearchForm } from './hotels/HotelSearchForm';
import { HotelResults } from './hotels/HotelResults';
import { HotelSearchWidget } from './hotels/HotelSearchWidget';
import { RecommendedDestinations } from './hotels/RecommendedDestinations';
import { hotelSearchParams, parseHotelSearch, type HotelSearch } from './hotels/hotelSearch';
import styles from './SectionScreen.module.css';

/**
 * 호텔 탭 — 웹은 제휴사 검색창 위젯(자동완성·결과는 위젯이 처리), 앱은 우리 화면:
 * 구글 자동완성으로 목적지를 고르면 그 좌표에서 가장 가까운 도시의 호텔을 우리 화면에 보여 주고(필터·정렬 포함),
 * 아래에 추천 여행지(내 일정의 도시 우선)를 띄운다. 예약만 예약 페이지로 나가고, 앱에서는 인앱 브라우저로 열린다.
 * 검색 조건은 주소에 담겨 새로고침해도 같은 결과가 나온다.
 */
export function HotelsScreen() {
  const { t } = useTranslation('home');
  const native = isNativeApp();
  const [params, setParams] = useSearchParams();
  const search = native ? parseHotelSearch(params) : null;
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    trackScreenView('hotels');
  }, []);

  function runSearch(next: HotelSearch) {
    setParams(hotelSearchParams(next), { replace: false });
    window.setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }

  return (
    <div className={styles.page}>
      <HomeSectionTabs />
      <div className={styles.wrap}>
        <header className={styles.header}>
          <h1 className={styles.title}>
            <BedDouble size={22} aria-hidden="true" /> {t('hotels.title')}
          </h1>
          <p className={styles.subtitle}>{t('hotels.subtitle')}</p>
        </header>
        {native ? (
          <>
            <HotelSearchForm
              key={search ? `${search.name}|${search.lat}|${search.lng}|${search.checkin}|${search.checkout}` : 'new'}
              initial={search}
              busy={false}
              onSearch={runSearch}
            />
            <div ref={resultsRef}>{search ? <HotelResults search={search} /> : null}</div>
            <RecommendedDestinations adults={search?.adults ?? 2} onSearch={runSearch} />
          </>
        ) : (
          <HotelSearchWidget />
        )}
      </div>
    </div>
  );
}
