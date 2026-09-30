import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { BrandLogo } from '@/shared/ui/BrandLogo';
import { CapsuleMobile, HeroDesktop } from './HeroTabs';
import { MyTripsSection } from './MyTripsSection';
import { DealsSection } from './DealsSection';
import { StoriesSection } from './StoriesSection';
import { SeasonSection } from './SeasonSection';
import { CompanionsSection } from './CompanionsSection';
import { StepsSection } from './StepsSection';
import { CtaBanner } from './CtaBanner';
import { HomeFooter } from './HomeFooter';
import styles from './HomePage.module.css';

/**
 * 홈 — Stitch 시안(Stitch/Home, PC·모바일 두 벌)을 그대로 옮긴 화면.
 * PC(1024px 이상)와 모바일은 섹션 순서가 달라서 화면 크기에 맞춰 각각 그린다:
 *   PC     히어로 → 내 일정 → 특가 → 인기 여행기 → 지금 가기 좋은 여행지 → 같이 갈 사람 → 이렇게 써요 → 시작 배너
 *   모바일 캡슐 → 내 일정 → 지금 가기 좋은 여행지 → 특가 → 같이 갈 사람 → 인기 여행기 → 이렇게 써요
 * 색·글꼴은 .page 안의 --h-* 토큰만 쓰고(HomePage.module.css) 다크 모드는 앱 토큰을 따라간다.
 */
export function HomePage() {
  const desktop = useMediaQuery('(min-width: 1024px)');

  return (
    <div className={styles.page}>
      {desktop ? (
        <HeroDesktop />
      ) : (
        <header className={styles.topBar}>
          <BrandLogo className={styles.topLogo} introAnchor />
        </header>
      )}
      <div className={styles.body}>
        {desktop ? (
          <>
            <MyTripsSection desktop />
            <DealsSection desktop />
            <StoriesSection desktop />
            <SeasonSection desktop />
            <CompanionsSection desktop />
            <StepsSection desktop />
            <CtaBanner />
          </>
        ) : (
          <>
            <CapsuleMobile />
            <MyTripsSection desktop={false} />
            <SeasonSection desktop={false} />
            <DealsSection desktop={false} />
            <CompanionsSection desktop={false} />
            <StoriesSection desktop={false} />
            <StepsSection desktop={false} />
          </>
        )}
      </div>
      <HomeFooter />
    </div>
  );
}
