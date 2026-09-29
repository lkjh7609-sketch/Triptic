import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Briefcase } from 'lucide-react';
import { trackScreenView } from '@/shared/monitoring';
import { HomeSectionTabs } from './HomeSectionTabs';
import { HotelSearchForm } from './HotelSearchForm';
import styles from './SectionScreen.module.css';

/**
 * 호텔 탭 — 여행지·기간·인원을 고르면 트립닷컴 호텔 검색 결과(제휴 링크)가 새 탭으로 열린다.
 * 예전에는 트립닷컴 위젯(iframe)을 넣었는데 늦게 뜨고 모양을 못 바꿔서 직접 만든 검색창으로 바꿨다.
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
      </div>
    </div>
  );
}
