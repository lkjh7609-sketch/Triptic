import styles from './Skeleton.module.css';

interface SkeletonProps {
  /** CSS 높이값. 예: '1rem', '120px' */
  height?: string;
  width?: string;
  radius?: string;
  className?: string;
}

/**
 * 로딩 상태 (01-design-system.md §6.7): 스피너 금지 — 레이아웃 점프를 유발한다.
 * 항상 스켈레톤으로 최종 콘텐츠와 같은 크기의 자리를 미리 잡아 둔다.
 */
export function Skeleton({ height = '1rem', width = '100%', radius, className }: SkeletonProps) {
  return (
    <div
      className={[styles.skeleton, className].filter(Boolean).join(' ')}
      style={{ height, width, borderRadius: radius ?? 'var(--radius-sm)' }}
      aria-hidden="true"
    />
  );
}
