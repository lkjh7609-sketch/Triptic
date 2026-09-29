import { BrandLogo } from '@/shared/ui/BrandLogo';
import styles from './HomeWordmark.module.css';

/** 모바일·태블릿 홈 좌측 상단 로고 — PC는 상단 바(HeaderDesktop)에 같은 로고가 있다 */
export function HomeWordmark() {
  return (
    <div className={styles.wordmark}>
      <BrandLogo className={styles.logo} />
    </div>
  );
}
