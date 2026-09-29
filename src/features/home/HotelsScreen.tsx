import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BedDouble, Briefcase, ExternalLink } from 'lucide-react';
import { trackScreenView } from '@/shared/monitoring';
import { HomeSectionTabs } from './HomeSectionTabs';
import { HOTELS_PARTNER_URL } from './hotelsPartner';
import styles from './SectionScreen.module.css';

/** 호텔 탭 — 숙소 제휴(아고다 승인 또는 Travelpayouts 호텔 위젯)가 정해질 때까지는 아고다로 연결 */
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
        <a href={HOTELS_PARTNER_URL} target="_blank" rel="noopener noreferrer" className={styles.cta}>
          <BedDouble size={18} aria-hidden="true" /> {t('hotels.cta')} <ExternalLink size={14} aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
