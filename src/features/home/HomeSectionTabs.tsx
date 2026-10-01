import { useLocation } from 'react-router';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { capsuleTabForPath } from './stitch/capsuleTabs';
import { SectionBandDesktop, SectionCapsuleMobile } from './stitch/HeroTabs';

/**
 * 항공·호텔·액티비티 화면 맨 위의 이동 탭 — 홈의 유리 캡슐과 같은 모양.
 * PC는 얇은 사진 띠 안의 캡슐, 모바일은 본문 맨 위의 캡슐(홈은 하단 탭바에 있다).
 */
export function HomeSectionTabs() {
  const desktop = useMediaQuery('(min-width: 1024px)');
  const active = capsuleTabForPath(useLocation().pathname);
  return desktop ? <SectionBandDesktop activeKey={active} /> : <SectionCapsuleMobile activeKey={active} />;
}
