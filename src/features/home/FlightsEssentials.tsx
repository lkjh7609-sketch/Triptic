import { useTranslation } from 'react-i18next';
import { ExternalLink, Smartphone } from 'lucide-react';
import { AFFILIATE_LINKS } from '@/shared/config';
import { cityDisplayName } from '@/features/plan/cityName';
import { MyrealtripProducts } from './MyrealtripProducts';
import { useNearestTrip } from './useNearestTrip';
import styles from './FlightsEssentials.module.css';

/**
 * 항공 탭(한국어) 검색 폼 아래 "유심·eSIM도 필요하신가요?" — 유심사 제휴 버튼 +
 * 마이리얼트립 유심·eSIM 상품(다음 여행 도시, 계획이 없으면 예시로 일본).
 * 여행자 보험은 마이리얼트립 수익 집계에서 빠지는 상품이라 넣지 않았다.
 */
export function FlightsEssentials() {
  const { t } = useTranslation('home');
  const nearestTrip = useNearestTrip();
  const tripCity = nearestTrip ? cityDisplayName(nearestTrip.city) : '';
  const city = tripCity || t('flights.essentials.defaultCity');

  return (
    <section className={styles.section} aria-labelledby="flights-essentials-title">
      <h2 id="flights-essentials-title" className={styles.title}>
        {t('flights.essentials.title')}
      </h2>
      <p className={styles.subtitle}>{t('flights.essentials.subtitle', { city })}</p>

      <a href={AFFILIATE_LINKS.usimsa} target="_blank" rel="sponsored noopener" className={styles.usimsa}>
        <span className={styles.usimsaIcon} aria-hidden="true">
          <Smartphone size={20} />
        </span>
        <span className={styles.usimsaText}>
          <span className={styles.usimsaTitle}>{t('flights.essentials.usimsaTitle')}</span>
          <span className={styles.usimsaDesc}>{t('flights.essentials.usimsaDesc')}</span>
        </span>
        <ExternalLink size={16} aria-hidden="true" className={styles.usimsaArrow} />
      </a>

      <h3 className={styles.subheading}>{t('flights.essentials.myrealtripTitle', { city })}</h3>
      <MyrealtripProducts
        keyword={city}
        kind="sim"
        count={4}
        placement="esim"
        seeAll={{ label: t('flights.essentials.seeAll', { city }), keyword: t('flights.essentials.simSearch', { city }), placement: 'esim' }}
      />
    </section>
  );
}
