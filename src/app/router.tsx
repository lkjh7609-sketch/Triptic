import { createBrowserRouter } from 'react-router';
import { AppShell } from './AppShell';
import { retryChunkLoad } from './chunkRetry';

/**
 * 하단 4탭 라우팅 (DEVELOPMENT_PLAN.md §7, §9 Phase 1~2)
 * 각 화면은 lazy 라우트로 분리한다 — 번들 예산(§10.1: 초기 로드 JS ≤ 250KB
 * gzip)이 계획/지도 관련 의존성(Google Maps 로더, dnd-kit 등) 추가로 임계치에
 * 근접해, 탭을 실제로 열 때만 해당 코드를 받도록 코드 스플리팅했다.
 * import()는 전부 retryChunkLoad로 감싼다 — 배포 직후 열려 있던 탭이 예전
 * 청크 경로로 요청하면 청크 로드 실패가 나는데, 그걸 자동 새로고침으로
 * 복구한다(chunkRetry.ts 참고).
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
            const { HomeScreen } = await retryChunkLoad(() => import('@/features/home/HomeScreen'));
            return { Component: HomeScreen };
          },
        },
        {
          path: 'plan',
          lazy: async () => {
            const { PlanScreen } = await retryChunkLoad(() => import('@/features/plan/PlanScreen'));
            return { Component: PlanScreen };
          },
        },
        {
          path: 'plan/:tripId',
          lazy: async () => {
            const { TripDetailScreen } = await retryChunkLoad(() => import('@/features/plan/TripDetailScreen'));
            return { Component: TripDetailScreen };
          },
        },
        {
          path: 'community',
          lazy: async () => {
            const { CommunityScreen } = await retryChunkLoad(() => import('@/features/community/CommunityScreen'));
            return { Component: CommunityScreen };
          },
        },
        {
          path: 'community/compose',
          lazy: async () => {
            const { ComposePostScreen } = await retryChunkLoad(() => import('@/features/community/ComposePostScreen'));
            return { Component: ComposePostScreen };
          },
        },
        {
          // 동행찾기(0032) — 목록은 CommunityScreen의 탭이라 별도 라우트가 없고,
          // 글쓰기/상세/매칭 화면만 라우트로 분리한다(글 상세와 같은 패턴).
          path: 'community/companion/new',
          lazy: async () => {
            const { CompanionComposeScreen } = await retryChunkLoad(() => import('@/features/community/CompanionComposeScreen'));
            return { Component: CompanionComposeScreen };
          },
        },
        {
          path: 'community/companion/:postId',
          lazy: async () => {
            const { CompanionDetailScreen } = await retryChunkLoad(() => import('@/features/community/CompanionDetailScreen'));
            return { Component: CompanionDetailScreen };
          },
        },
        {
          path: 'community/companion/:postId/match',
          lazy: async () => {
            const { CompanionMatchScreen } = await retryChunkLoad(() => import('@/features/community/CompanionMatchScreen'));
            return { Component: CompanionMatchScreen };
          },
        },
        {
          // 매칭 확정 시 개설되는 채팅방(0033)
          path: 'community/companion/:postId/chat',
          lazy: async () => {
            const { CompanionChatScreen } = await retryChunkLoad(() => import('@/features/community/CompanionChatScreen'));
            return { Component: CompanionChatScreen };
          },
        },
        {
          path: 'community/d/:slug',
          lazy: async () => {
            const { DestinationChannelScreen } = await retryChunkLoad(() => import('@/features/community/DestinationChannelScreen'));
            return { Component: DestinationChannelScreen };
          },
        },
        {
          path: 'community/post/:postId',
          lazy: async () => {
            const { PostDetailScreen } = await retryChunkLoad(() => import('@/features/community/PostDetailScreen'));
            return { Component: PostDetailScreen };
          },
        },
        {
          // 글에 첨부된 일정 읽기 전용 뷰 + 복제(0036)
          path: 'community/post/:postId/trip',
          lazy: async () => {
            const { PostTripViewScreen } = await retryChunkLoad(() => import('@/features/community/PostTripViewScreen'));
            return { Component: PostTripViewScreen };
          },
        },
        {
          path: 'community/user/:userId',
          lazy: async () => {
            const { UserProfileScreen } = await retryChunkLoad(() => import('@/features/community/UserProfileScreen'));
            return { Component: UserProfileScreen };
          },
        },
        {
          // 항공권 검색(Travelpayouts White Label 위젯)
          path: 'flights',
          lazy: async () => {
            const { FlightsScreen } = await retryChunkLoad(() => import('@/features/home/FlightsScreen'));
            return { Component: FlightsScreen };
          },
        },
        {
          path: 'settings',
          lazy: async () => {
            const { SettingsScreen } = await retryChunkLoad(() => import('@/features/settings/SettingsScreen'));
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
        const { SharedTripScreen } = await retryChunkLoad(() => import('@/features/shared/SharedTripScreen'));
        return { Component: SharedTripScreen };
      },
    },
    {
      // 운영 콘솔(06-community.md §9) — 하단 탭 셸 밖의 독립 화면, role='admin'만 실제 데이터를 본다
      path: 'admin',
      lazy: async () => {
        const { AdminScreen } = await retryChunkLoad(() => import('@/features/community/AdminScreen'));
        return { Component: AdminScreen };
      },
    },
  ],
);

// 모든 화면 이동에 View Transition을 켠다(애니메이션은 global.css의 html[data-nav]).
// Link/useNavigate/<Navigate>가 전부 결국 router.navigate를 거치므로, 70여 개 호출부에
// viewTransition 옵션을 일일이 붙이는 대신 여기 한 곳에서 기본값으로 넣는다. 숫자 이동
// (navigate(-1))과 브라우저 뒤로가기는 react-router가 앞서 적용한 전환을 거꾸로 재생한다.
// 미지원 브라우저에서는 옵션 자체를 안 넣어야 react-router 경고가 안 뜬다.
if (typeof document !== 'undefined' && typeof document.startViewTransition === 'function') {
  const navigateWithoutTransition = router.navigate.bind(router);
  router.navigate = ((to: Parameters<typeof router.navigate>[0], opts?: Parameters<typeof router.navigate>[1]) =>
    typeof to === 'number'
      ? navigateWithoutTransition(to)
      : // <Link>는 viewTransition: undefined를 명시적으로 넘기므로 스프레드 기본값이 아니라 ??로
        navigateWithoutTransition(to, { ...opts, viewTransition: opts?.viewTransition ?? true })) as typeof router.navigate;
}
