import { createBrowserRouter } from 'react-router';
import { AppShell } from './AppShell';

/**
 * 하단 4탭 라우팅 (DEVELOPMENT_PLAN.md §7, §9 Phase 1~2)
 * 각 화면은 lazy 라우트로 분리한다 — 번들 예산(§10.1: 초기 로드 JS ≤ 250KB
 * gzip)이 계획/지도 관련 의존성(Google Maps 로더, dnd-kit 등) 추가로 임계치에
 * 근접해, 탭을 실제로 열 때만 해당 코드를 받도록 코드 스플리팅했다.
 */
export const router = createBrowserRouter(
  [
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
          path: 'community/compose',
          lazy: async () => {
            const { ComposePostScreen } = await import('@/features/community/ComposePostScreen');
            return { Component: ComposePostScreen };
          },
        },
        {
          // 동행찾기(0032) — 목록은 CommunityScreen의 탭이라 별도 라우트가 없고,
          // 글쓰기/상세/매칭 화면만 라우트로 분리한다(글 상세와 같은 패턴).
          path: 'community/companion/new',
          lazy: async () => {
            const { CompanionComposeScreen } = await import('@/features/community/CompanionComposeScreen');
            return { Component: CompanionComposeScreen };
          },
        },
        {
          path: 'community/companion/:postId',
          lazy: async () => {
            const { CompanionDetailScreen } = await import('@/features/community/CompanionDetailScreen');
            return { Component: CompanionDetailScreen };
          },
        },
        {
          path: 'community/companion/:postId/match',
          lazy: async () => {
            const { CompanionMatchScreen } = await import('@/features/community/CompanionMatchScreen');
            return { Component: CompanionMatchScreen };
          },
        },
        {
          path: 'community/d/:slug',
          lazy: async () => {
            const { DestinationChannelScreen } = await import('@/features/community/DestinationChannelScreen');
            return { Component: DestinationChannelScreen };
          },
        },
        {
          path: 'community/post/:postId',
          lazy: async () => {
            const { PostDetailScreen } = await import('@/features/community/PostDetailScreen');
            return { Component: PostDetailScreen };
          },
        },
        {
          path: 'community/user/:userId',
          lazy: async () => {
            const { UserProfileScreen } = await import('@/features/community/UserProfileScreen');
            return { Component: UserProfileScreen };
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
    {
      // 공유 링크(/shared/:code)는 하단 4탭 셸(AppShell) 밖의 독립 화면이다 — 로그인
      // 없이 누구나 열 수 있어야 하고, legacy도 로비/탭 없이 읽기 전용 뷰만 보여줬다
      // (index.html openSharedView가 app-screen에 shared-view 클래스만 추가하고
      // 로비를 완전히 감춘 것과 동일한 구조).
      path: 'shared/:code',
      lazy: async () => {
        const { SharedTripScreen } = await import('@/features/shared/SharedTripScreen');
        return { Component: SharedTripScreen };
      },
    },
    {
      // 운영 콘솔(06-community.md §9) — 하단 탭 셸 밖의 독립 화면, role='admin'만 실제 데이터를 본다
      path: 'admin',
      lazy: async () => {
        const { AdminScreen } = await import('@/features/community/AdminScreen');
        return { Component: AdminScreen };
      },
    },
  ],
);
