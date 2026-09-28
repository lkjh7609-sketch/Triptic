import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Smartphone } from 'lucide-react';
import { AFFILIATE_LINKS } from '@/shared/config';
import { PoweredBy } from '@/shared/ui/PoweredBy';
import { cityDisplayName } from '@/features/plan/cityName';
import { MyrealtripProducts } from './MyrealtripProducts';
import { useNearestTrip } from './useNearestTrip';
import styles from './FlightsEssentials.module.css';

/** 계획 중인 여행이 없을 때 보여줄 도시 */
const DEFAULT_CITY_KEYS = ['cityTokyo', 'cityHanoi'] as const;

/**
 * 항공 탭(한국어) 검색 폼 아래 "유심·eSIM도 필요하신가요?" — 유심사 제휴 버튼 +
 * 마이리얼트립 유심·eSIM 상품(다음 여행 도시, 없으면 도쿄·하노이 중 선택).
 * 여행자 보험은 마이리얼트립 수익 집계에서 빠지는 상품이라 넣지 않았다.
 */
export function FlightsEssentials() {
  const { t } = useTranslation('home');
  const nearestTrip = useNearestTrip();
  const tripCity = nearestTrip ? cityDisplayName(nearestTrip.city) : '';
  const [defaultKey, setDefaultKey] = useState<(typeof DEFAULT_CITY_KEYS)[number]>('cityTokyo');
  const city = tripCity || t(`flights.essentials.${defaultKey}`);

  return (
    <section className={styles.section} aria-labelledby="flights-essentials-title">
      <h2 id="flights-essentials-title" className={styles.title}>
        {t('flights.essentials.title')}
      </h2>
      <p className={styles.subtitle}>{t('flights.essentials.subtitle', { city })}</p>

      {!tripCity ? (
        <div className={styles.cities} role="group" aria-label={t('flights.essentials.cityLabel')}>
          {DEFAULT_CITY_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={defaultKey === key}
              className={defaultKey === key ? styles.cityOn : styles.cityOff}
              onClick={() => setDefaultKey(key)}
            >
              {t(`flights.essentials.${key}`)}
            </button>
          ))}
        </div>
      ) : null}

      <a href={AFFILIATE_LINKS.usimsa} target="_blank" rel="sponsored noopener" className={styles.usimsa}>
        <span className={styles.usimsaIcon} aria-hidden="true">
          <Smartphone size={20} />
        </span>
        <span className={styles.usimsaText}>
          <span className={styles.usimsaTitle}>{t('flights.essentials.usimsaTitle')}</span>
          <span className={styles.usimsaDesc}>{t('flights.essentials.usimsaDesc')}</span>
          <PoweredBy brand="usimsa" />
        </span>
        <ExternalLink size={16} aria-hidden="true" className={styles.usimsaArrow} />
      </a>

      <div className={styles.subheadRow}>
        <h3 className={styles.subheading}>{t('flights.essentials.myrealtripTitle', { city })}</h3>
        <PoweredBy brand="myrealtrip" />
      </div>
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
