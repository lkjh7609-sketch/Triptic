import { createBrowserRouter } from 'react-router';
import { AppShell } from './AppShell';
import { HomeScreen } from '@/features/home/HomeScreen';
import { PlanScreen } from '@/features/plan/PlanScreen';
import { TripDetailScreen } from '@/features/plan/TripDetailScreen';
import { CommunityScreen } from '@/features/community/CommunityScreen';
import { SettingsScreen } from '@/features/settings/SettingsScreen';

/**
 * 하단 4탭 라우팅 (DEVELOPMENT_PLAN.md §7, §9 Phase 1~2)
 * 탭별 세부 화면(글 상세 등)은 각 담당 Phase에서 계속 중첩 라우트로 추가한다.
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <HomeScreen /> },
      { path: 'plan', element: <PlanScreen /> },
      { path: 'plan/:tripId', element: <TripDetailScreen /> },
      { path: 'community', element: <CommunityScreen /> },
      { path: 'settings', element: <SettingsScreen /> },
    ],
  },
]);
