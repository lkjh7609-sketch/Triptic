import { useEffect } from 'react';
import { trackScreenView } from '@/shared/monitoring';
import { HomeDesktop } from './HomeDesktop';

/**
 * 홈 탭 — 검색 + 카테고리 + 추천 여행지 발견 화면 (02-screens.md §2)
 * 개인 여행 대시보드(진행/예정 여행, 통계)는 계획 탭(PlanDesktop)으로 옮겼다 —
 * 홈은 화면 크기와 무관하게 항상 이 발견 중심 레이아웃 하나를 쓴다.
 */
export function HomeScreen() {
  useEffect(() => {
    trackScreenView('home');
  }, []);

  return <HomeDesktop />;
}
