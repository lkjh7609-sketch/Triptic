import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { BedDouble } from 'lucide-react';
import { trackScreenView } from '@/shared/monitoring';
import { HomeSectionTabs } from './HomeSectionTabs';
import { HotelSearchForm } from './hotels/HotelSearchForm';
import { HotelResults } from './hotels/HotelResults';
import { hotelSearchParams, parseHotelSearch, type HotelSearch } from './hotels/hotelSearch';
import styles from './SectionScreen.module.css';

/**
 * 호텔 탭 — Kayak(호텔스컴바인 포함) 호텔 검색. 검색폼(자동완성·달력·객실/인원)과 결과 목록·필터는 우리 화면이고,
 * 예약은 Kayak 예약 링크(새 탭)로 나간다. 검색 조건은 주소에 담겨 새로고침해도 같은 결과가 나온다.
 * 트립닷컴 위젯·배너는 2026-10-04에 뺐다.
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
        <HotelSearchForm key={search ? `${search.destination}|${search.checkin}|${search.checkout}` : 'new'} initial={search} busy={false} onSearch={runSearch} />
        <div ref={resultsRef}>{search ? <HotelResults search={search} /> : null}</div>
      </div>
    </div>
  );
}
