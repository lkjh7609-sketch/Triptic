import { BrandLogo } from '@/shared/ui/BrandLogo';
import styles from './HomeTopBar.module.css';

/** 모바일 상단 로고 줄 */
export function HomeTopBar() {
  return (
    <header className={styles.topBar}>
      <BrandLogo className={styles.topLogo} />
    </header>
  );
}
