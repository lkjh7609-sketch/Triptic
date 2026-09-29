import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Briefcase } from 'lucide-react';
import { trackScreenView } from '@/shared/monitoring';
import { HomeSectionTabs } from './HomeSectionTabs';
import { HotelSearchForm } from './HotelSearchForm';
import { TripHotelCards } from './TripHotelCards';
import styles from './SectionScreen.module.css';

/**
 * 호텔 탭 — 여행지·기간·인원을 고르면 트립닷컴 호텔 검색 결과(제휴 링크)가 새 탭으로 열린다.
 * 검색창은 직접 만들었다(예전 트립닷컴 검색 위젯은 늦게 뜨고 모양을 못 바꿔서 뺐다). 그 아래에는 트립닷컴
 * 추천 호텔 배너 3개(TripHotelCards)를 둔다.
 */
export function HotelsScreen() {
  const { t } = useTranslation('home');

  useEffect(() => {
    trackScreenView('hotels');
  }, []);

  return (
    <div className={styles.page}>
      <HomeSectionTabs />
      <div className={styles.wrap}>
        <header className={styles.header}>
          <h1 className={styles.title}>
            <Briefcase size={22} aria-hidden="true" /> {t('hotels.title')}
          </h1>
          <p className={styles.subtitle}>{t('hotels.subtitle')}</p>
        </header>
        <HotelSearchForm />
        <TripHotelCards />
      </div>
    </div>
  );
}
