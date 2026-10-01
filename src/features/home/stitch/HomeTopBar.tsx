import { BrandLogo } from '@/shared/ui/BrandLogo';
import styles from './HomeTopBar.module.css';

/** 모바일 상단 로고 줄. 홈이 인트로 애니메이션의 로고 자리(introAnchor)를 맡는다 */
export function HomeTopBar({ introAnchor = false }: { introAnchor?: boolean }) {
  return (
    <header className={styles.topBar}>
      <BrandLogo className={styles.topLogo} introAnchor={introAnchor} />
    </header>
  );
}
