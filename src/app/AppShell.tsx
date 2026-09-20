import { Outlet } from 'react-router';
import { TabBar } from './TabBar';
import styles from './AppShell.module.css';

/**
 * 4탭 셸 (DEVELOPMENT_PLAN.md §6, §7.1~7.5)
 * 스크롤 컨테이너 하단 여백은 각 화면에서 tab-bar 높이만큼 확보한다
 * (01-design-system.md §5.1).
 */
export function AppShell() {
  return (
    <div className={`app-shell ${styles.shell}`}>
      <main className={styles.content}>
        <Outlet />
      </main>
      <TabBar />
    </div>
  );
}
