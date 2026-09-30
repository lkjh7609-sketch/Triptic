import { useEffect } from 'react';
import { trackScreenView } from '@/shared/monitoring';
import { HomePage } from './stitch/HomePage';

/**
 * 홈 탭 — Stitch 시안대로 만든 발견 화면(stitch/HomePage.tsx).
 * 개인 여행 대시보드(진행/예정 여행, 통계)는 계획 탭(PlanDesktop)에 있고,
 * 홈은 화면 크기에 맞춰 PC/모바일 구성 중 하나를 그린다.
 */
export function HomeScreen() {
  useEffect(() => {
    trackScreenView('home');
  }, []);

  return <HomePage />;
}
