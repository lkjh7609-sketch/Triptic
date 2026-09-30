import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BedDouble } from 'lucide-react';
import { trackScreenView } from '@/shared/monitoring';
import { HomeSectionTabs } from './HomeSectionTabs';
import { TripHotelsSection } from './TripHotelsSection';
import styles from './SectionScreen.module.css';

/**
 * 호텔 탭 — 트립닷컴 제휴: 검색 위젯 + 추천 호텔 배너 3개(TripHotelsSection).
 * 직접 만든 검색창은 위젯이 필요할 때 다시 쓸 수 있게 커밋 0fd0fec·14c26f9에 남겨 두었다.
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
            <BedDouble size={22} aria-hidden="true" /> {t('hotels.title')}
          </h1>
          <p className={styles.subtitle}>{t('hotels.subtitle')}</p>
        </header>
        <TripHotelsSection />
      </div>
    </div>
  );
}
