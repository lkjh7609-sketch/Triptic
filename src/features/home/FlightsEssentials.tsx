import { useTranslation } from 'react-i18next';
import { ArrowRight, MapPin, ShieldCheck, Smartphone } from 'lucide-react';
import { AFFILIATE_LINKS } from '@/shared/config';
import { cityDisplayName } from '@/features/plan/cityName';
import { MyrealtripProducts } from './MyrealtripProducts';
import { useNearestTrip } from './useNearestTrip';
import styles from './FlightsEssentials.module.css';

/**
 * 항공 탭(한국어) "유심·eSIM도 필요하신가요?" — 두 칸으로 나눈다.
 * 왼쪽: 유심사 제휴 카드(버튼은 유심사로), 오른쪽: 마이리얼트립 유심·eSIM 상품(다음 여행 도시, 계획이 없으면 예시로 일본).
 * 여행자 보험은 마이리얼트립 수익 집계에서 빠지는 상품이라 넣지 않았다.
 */
export function FlightsEssentials() {
  const { t } = useTranslation('home');
  const nearestTrip = useNearestTrip();
  const tripCity = nearestTrip ? cityDisplayName(nearestTrip.city) : '';
  const city = tripCity || t('flights.essentials.defaultCity');

  return (
    <section className={styles.section} aria-labelledby="flights-essentials-title">
      <div className={styles.grid}>
        <div className={styles.usimsa}>
          <div className={styles.usimsaHead}>
            <span className={styles.usimsaIcon} aria-hidden="true">
              <Smartphone size={22} />
            </span>
            <div>
              <span className={styles.eyebrow}>{t('flights.essentials.eyebrow')}</span>
              <h2 id="flights-essentials-title" className={styles.title}>
                {t('flights.essentials.title')}
              </h2>
            </div>
          </div>
          <p className={styles.desc}>{t('flights.essentials.usimsaDesc')}</p>

          {/* 유심사가 내세우는 혜택(유심사 안내 그대로) — 카드 아래쪽에 한 덩어리로 */}
          <ul className={styles.benefits}>
            <li className={styles.benefit}>
              <span className={styles.benefitIcon} aria-hidden="true">
                <ShieldCheck size={18} />
              </span>
              <span className={styles.benefitText}>
                {t('flights.essentials.badgeCare')} <strong className={styles.benefitStrong}>{t('flights.essentials.badgeCareAmount')}</strong>
              </span>
            </li>
            <li className={styles.benefit}>
              <span className={styles.benefitIcon} aria-hidden="true">
                <MapPin size={18} />
              </span>
              <span className={styles.benefitText}>{t('flights.essentials.badgeData')}</span>
            </li>
          </ul>

          <a href={AFFILIATE_LINKS.usimsa} target="_blank" rel="sponsored noopener" className={styles.usimsaButton}>
            {t('flights.essentials.usimsaCta')}
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>

        <div className={styles.myrealtrip}>
          <h3 className={styles.subheading}>{t('flights.essentials.myrealtripTitle', { city })}</h3>
          <MyrealtripProducts
            keyword={city}
            kind="sim"
            count={4}
            placement="esim"
            seeAll={{ label: t('flights.essentials.seeAll', { city }), keyword: t('flights.essentials.simSearch', { city }), placement: 'esim' }}
          />
        </div>
      </div>
    </section>
  );
}
