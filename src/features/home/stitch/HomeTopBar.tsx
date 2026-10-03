import { NotificationBell } from '@/features/notifications/NotificationBell';
import { BrandLogo } from '@/shared/ui/BrandLogo';
import styles from './HomeTopBar.module.css';

/** 모바일 상단 줄 — 로고, 오른쪽 끝에 알림 종(로그인했을 때만) */
export function HomeTopBar() {
  return (
    <header className={styles.topBar}>
      <BrandLogo className={styles.topLogo} />
      <div className={styles.topActions}>
        <NotificationBell />
      </div>
    </header>
  );
}
