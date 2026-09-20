import { createBrowserRouter } from 'react-router';
import { AppShell } from './AppShell';

/**
 * 하단 4탭 라우팅 (DEVELOPMENT_PLAN.md §7, §9 Phase 1~2)
 * 각 화면은 lazy 라우트로 분리한다 — 번들 예산(§10.1: 초기 로드 JS ≤ 250KB
 * gzip)이 계획/지도 관련 의존성(Google Maps 로더, dnd-kit 등) 추가로 임계치에
 * 근접해, 탭을 실제로 열 때만 해당 코드를 받도록 코드 스플리팅했다.
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        lazy: async () => {
          const { HomeScreen } = await import('@/features/home/HomeScreen');
          return { Component: HomeScreen };
        },
      },
      {
        path: 'plan',
        lazy: async () => {
          const { PlanScreen } = await import('@/features/plan/PlanScreen');
          return { Component: PlanScreen };
        },
      },
      {
        path: 'plan/:tripId',
        lazy: async () => {
          const { TripDetailScreen } = await import('@/features/plan/TripDetailScreen');
          return { Component: TripDetailScreen };
        },
      },
      {
        path: 'community',
        lazy: async () => {
          const { CommunityScreen } = await import('@/features/community/CommunityScreen');
          return { Component: CommunityScreen };
        },
      },
      {
        path: 'settings',
        lazy: async () => {
          const { SettingsScreen } = await import('@/features/settings/SettingsScreen');
          return { Component: SettingsScreen };
        },
      },
    ],
  },
]);
