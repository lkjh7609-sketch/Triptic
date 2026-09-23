import { Outlet, useNavigation } from 'react-router';
import { TabBar } from './TabBar';
import { HeaderDesktop } from './HeaderDesktop';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { useSession } from '@/shared/hooks/useSession';
import { GlobalAuthModal } from '@/features/auth/GlobalAuthModal';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import styles from './AppShell.module.css';

/**
 * 4탭 셸 (DEVELOPMENT_PLAN.md §6, §7.1~7.5)
 * 스크롤 컨테이너 하단 여백은 각 화면에서 tab-bar 높이만큼 확보한다
 * (01-design-system.md §5.1).
 * lazy 라우트(router.tsx) 코드가 로드되는 동안 스켈레톤을 보여준다 —
 * 스피너 금지 원칙(01-design-system.md §6.7)을 탭 전환에도 그대로 적용.
 */
export function AppShell() {
  const navigation = useNavigation();
  const isLoadingRoute = navigation.state === 'loading';
  const { user, loading } = useSession();
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  if (!loading && !user) {
    return <GlobalAuthModal />;
  }

  return (
    <div className={`app-shell ${styles.shell}`}>
      {isDesktop && <HeaderDesktop />}
      <main className={styles.content}>
        {isLoadingRoute ? (
          <div style={{ padding: 16 }}>
            <Skeleton height="24px" width="50%" />
            <div style={{ height: 12 }} />
            <Skeleton height="88px" />
          </div>
        ) : (
          <Outlet />
        )}
      </main>
      {!isDesktop && <TabBar />}
    </div>
  );
}
