import { useTranslation } from 'react-i18next';
import styles from './PoweredBy.module.css';

/** 제휴 위젯·검색창 옆 "Powered by <공식 로고>" — 로고는 각 회사 공식 SVG(public/brands) */
export type PartnerBrand = 'myrealtrip' | 'usimsa' | 'klook' | 'airalo' | 'aviasales';

const BRANDS: Record<PartnerBrand, { name: string; logo: string }> = {
  myrealtrip: { name: 'MyRealTrip', logo: '/brands/myrealtrip.svg' },
  usimsa: { name: 'Usimsa', logo: '/brands/usimsa.svg' },
  klook: { name: 'Klook', logo: '/brands/klook.svg' },
  airalo: { name: 'Airalo', logo: '/brands/airalo.svg' },
  // 항공 위젯(Travelpayouts White Label)의 검색 엔진
  aviasales: { name: 'Aviasales', logo: '/brands/aviasales.svg' },
};

/**
 * 로고는 흰 칩 위에 — 다크 모드에서도 검은 글자 로고(마이리얼트립 등)가 보이게.
 * align="end"면 오른쪽 정렬 한 줄로(검색창·위젯 바로 아래).
 */
export function PoweredBy({ brand, align = 'start' }: { brand: PartnerBrand; align?: 'start' | 'end' }) {
  const { t } = useTranslation('common');
  const b = BRANDS[brand];
  return (
    <span className={align === 'end' ? `${styles.poweredBy} ${styles.end}` : styles.poweredBy}>
      <span className={styles.label}>{t('poweredBy')}</span>
      <span className={styles.chip}>
        <img src={b.logo} alt={b.name} className={styles.logo} loading="lazy" />
      </span>
    </span>
  );
}
