import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Ticket } from 'lucide-react';
import { trackScreenView } from '@/shared/monitoring';
import { AFFILIATE_LINKS } from '@/shared/config';
import { useKlookActivitiesLink } from '@/features/plan/partnerLinks';
import { FEATURED, type FeaturedDestination } from './featuredDestinations';
import { HomeSectionTabs } from './HomeSectionTabs';
import styles from './SectionScreen.module.css';

/** 도시 하나 = 제휴 링크 하나(훅은 map 안에서 못 불러서 카드 단위 컴포넌트로) */
function CityActivityCard({ dest }: { dest: FeaturedDestination }) {
  const { t, i18n } = useTranslation('home');
  const href = useKlookActivitiesLink(dest.city, i18n.language);
  return (
    <a href={href} target="_blank" rel="sponsored noopener" className={styles.cityCard}>
      <img src={dest.image} alt="" className={styles.cityImage} loading="lazy" />
      <span className={styles.cityName}>{t(`desktop.dest${dest.key}`)}</span>
    </a>
  );
}

/** 액티비티 탭 — Klook(Travelpayouts 제휴). 도시 카드는 그 도시 검색 결과로 */
export function ActivitiesScreen() {
  const { t } = useTranslation('home');

  useEffect(() => {
    trackScreenView('activities');
  }, []);

  return (
    <div className={styles.page}>
      <HomeSectionTabs />
      <div className={styles.wrap}>
        <header className={styles.header}>
          <h1 className={styles.title}>{t('activities.title')}</h1>
          <p className={styles.subtitle}>{t('activities.subtitle')}</p>
        </header>
        <a href={AFFILIATE_LINKS.klookActivities} target="_blank" rel="sponsored noopener" className={styles.cta}>
          <Ticket size={18} aria-hidden="true" /> {t('activities.cta')} <ExternalLink size={14} aria-hidden="true" />
        </a>
        <h2 className={styles.sectionTitle}>{t('activities.popular')}</h2>
        <div className={styles.cityGrid}>
          {FEATURED.map((dest) => (
            <CityActivityCard key={dest.key} dest={dest} />
          ))}
        </div>
      </div>
    </div>
  );
}
