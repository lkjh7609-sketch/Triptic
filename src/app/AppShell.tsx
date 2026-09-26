import { useState } from 'react';
import { Outlet, useLocation, useNavigation } from 'react-router';
import { TabBar } from './TabBar';
import { HeaderDesktop } from './HeaderDesktop';
import { GuestBanner } from './GuestBanner';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { useSession } from '@/shared/hooks/useSession';
import { GlobalAuthModal } from '@/features/auth/GlobalAuthModal';
import { SAMPLE_TRIP_ID } from '@/features/plan/sampleTrip';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import styles from './AppShell.module.css';

function RouteSkeleton() {
  return (
    <div style={{ padding: 16 }}>
      <Skeleton height="24px" width="50%" />
      <div style={{ height: 12 }} />
      <Skeleton height="88px" />
    </div>
  );
}

/**
 * 4탭 셸 (DEVELOPMENT_PLAN.md §6, §7.1~7.5)
 * 스크롤 컨테이너 하단 여백은 각 화면에서 tab-bar 높이만큼 확보한다
 * (01-design-system.md §5.1).
 * lazy 라우트(router.tsx) 코드가 로드되는 동안 스켈레톤을 보여준다 —
 * 스피너 금지 원칙(01-design-system.md §6.7)을 탭 전환에도 그대로 적용.
 *
 * 비로그인: 로그인 화면으로 막는다. 예외는 샘플 여행 하나(/plan/sample-…) —
 * 로그인 없이 실제 편집 화면을 체험할 수 있고(저장 안 됨), 상단 배너로 로그인할 수 있다.
 */
export function AppShell() {
  const navigation = useNavigation();
  const { pathname } = useLocation();
  const isLoadingRoute = navigation.state === 'loading';
  const { user, loading } = useSession();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [authOpen, setAuthOpen] = useState(false);

  const isGuestSample = !user && pathname === `/plan/${SAMPLE_TRIP_ID}`;

  if (loading) {
    return (
      <div className={`app-shell ${styles.shell}`}>
        <RouteSkeleton />
      </div>
    );
  }

  if (!user && !isGuestSample) {
    return <GlobalAuthModal />;
  }

  return (
    <div className={`app-shell ${styles.shell}`}>
      {isGuestSample ? <GuestBanner onLogin={() => setAuthOpen(true)} /> : isDesktop && <HeaderDesktop />}
      <main className={styles.content}>{isLoadingRoute ? <RouteSkeleton /> : <Outlet />}</main>
      {!isGuestSample && !isDesktop && <TabBar />}
      {isGuestSample && authOpen ? <GlobalAuthModal onClose={() => setAuthOpen(false)} /> : null}
    </div>
  );
}
