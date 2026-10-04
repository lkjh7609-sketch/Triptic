import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlaneTakeoff } from 'lucide-react';
import { trackScreenView } from '@/shared/monitoring';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { SectionBandDesktop, SectionCapsuleMobile, type CapsuleCustom } from '../stitch/HeroTabs';
import pageStyles from '../stitch/HomePage.module.css';
import { HomeFooter } from '../stitch/HomeFooter';
import { AirportBoard } from './AirportBoard';
import styles from './AirportScreen.module.css';

/** 공항 탭의 칸 — 인천이 처음에 보이고, 나머지는 한국공항공사 데이터를 연결하는 대로 채운다 */
export const AIRPORT_KEYS = ['icn', 'tae', 'pus', 'cju'] as const;
export type AirportKey = (typeof AIRPORT_KEYS)[number];

/**
 * 공항 화면 — 맨 위 메뉴의 "공항". 홈의 유리 캡슐과 같은 모양으로 공항을 고르고(인천·대구·김해·제주, 인천이 처음),
 * 고른 공항의 실시간 출·도착 전광판을 보여 준다. 인천 말고는 아직 데이터가 없어 준비 중 안내.
 * (앞으로 주차장 실시간 정보 같은 공항 정보가 이 화면에 더해진다)
 */
export function AirportScreen() {
  const { t } = useTranslation('home');
  const desktop = useMediaQuery('(min-width: 1024px)');
  const [airport, setAirport] = useState<AirportKey>('icn');

  useEffect(() => {
    trackScreenView('airports');
  }, []);

  const custom: CapsuleCustom = useMemo(
    () => ({
      items: AIRPORT_KEYS.map((key) => ({ key, label: t(`airportPage.tabs.${key}`) })),
      onSelect: (key) => setAirport(key as AirportKey),
      ariaLabel: t('airportPage.label'),
    }),
    [t],
  );

  return (
    <div className={pageStyles.page}>
      {desktop ? <SectionBandDesktop activeKey={airport} custom={custom} /> : <SectionCapsuleMobile activeKey={airport} custom={custom} />}
      <div className={`${pageStyles.body} ${styles.content}`}>
        <h1 className={styles.srOnly}>{t('airportPage.title')}</h1>
        {airport === 'icn' ? (
          <AirportBoard desktop={desktop} standalone />
        ) : (
          <section className={styles.soon} aria-labelledby="airport-soon-title">
            <PlaneTakeoff size={28} aria-hidden="true" className={styles.soonIcon} />
            <h2 id="airport-soon-title" className={styles.soonTitle}>
              {t('airportPage.soon', { name: t(`airportPage.full.${airport}`) })}
            </h2>
            <p className={styles.soonDesc}>{t('airportPage.soonDesc')}</p>
          </section>
        )}
      </div>
      <HomeFooter />
    </div>
  );
}
