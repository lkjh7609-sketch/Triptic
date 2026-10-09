import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { BedDouble } from 'lucide-react';
import { trackScreenView } from '@/shared/monitoring';
import { HomeSectionTabs } from './HomeSectionTabs';
import { HotelSearchForm } from './hotels/HotelSearchForm';
import { HotelResults } from './hotels/HotelResults';
import { RecommendedDestinations } from './hotels/RecommendedDestinations';
import { hotelSearchParams, parseHotelSearch, type HotelSearch } from './hotels/hotelSearch';
import styles from './SectionScreen.module.css';

/**
 * 호텔 탭(웹·앱 같은 화면) — 목적지 칸에서 호텔 이름 또는 도시를 고르면 우리 화면에 결과를 보여 준다(필터·정렬 포함).
 *  · 도시: 그 좌표에서 가장 가까운 도시의 호텔
 *  · 호텔 이름: 그 호텔을 맨 위에 고정하고 같은 도시의 추천 호텔을 아래에
 * 아래에 추천 여행지(내 일정의 도시 우선)를 띄운다. 예약만 예약 페이지로 나가고, 앱에서는 인앱 브라우저로 열린다.
 * 검색 조건은 주소에 담겨 새로고침해도 같은 결과가 나온다. 제휴 검색을 못 쓰면(키 없음 등) 웹은 제휴사 검색창 위젯으로 대신한다(HotelResults).
 */
export function HotelsScreen() {
  const { t } = useTranslation('home');
  const [params, setParams] = useSearchParams();
  const search = parseHotelSearch(params);
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
        <HotelSearchForm
          key={search ? `${search.name}|${search.lat}|${search.lng}|${search.checkin}|${search.checkout}|${search.hotelId ?? ''}` : 'new'}
          initial={search}
          busy={false}
          onSearch={runSearch}
        />
        <div ref={resultsRef}>{search ? <HotelResults search={search} /> : null}</div>
        <RecommendedDestinations adults={search?.adults ?? 2} onSearch={runSearch} />
      </div>
    </div>
  );
}
