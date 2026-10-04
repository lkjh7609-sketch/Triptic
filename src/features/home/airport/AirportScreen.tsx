import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { trackScreenView } from '@/shared/monitoring';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { SectionBandDesktop, SectionCapsuleMobile, type CapsuleCustom } from '../stitch/HeroTabs';
import pageStyles from '../stitch/HomePage.module.css';
import { HomeFooter } from '../stitch/HomeFooter';
import { AirportBoard } from './AirportBoard';
import { ParkingMap } from './ParkingMap';
import { AIRPORT_KEYS, type AirportKey } from './airports';
import styles from './AirportScreen.module.css';


/**
 * 공항 화면 — 맨 위 메뉴의 "공항". 홈의 유리 캡슐과 같은 모양으로 공항을 고르고(인천·김포·대구·김해·제주, 인천이 처음),
 * 고른 공항의 실시간 출·도착 전광판(인천=인천국제공항공사, 나머지=한국공항공사)과 그 아래 주차장 평면도(ParkingMap)를 보여 준다.
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
        <AirportBoard key={`board-${airport}`} airport={airport} desktop={desktop} standalone />
        {/* 주차장 남은 자리·혼잡도 — 각 공항 실시간 출·도착 아래(사용자 결정). 공항을 바꾸면 선택·확대를 처음부터 */}
        <ParkingMap key={`parking-${airport}`} airport={airport} />
      </div>
      <HomeFooter />
    </div>
  );
}
