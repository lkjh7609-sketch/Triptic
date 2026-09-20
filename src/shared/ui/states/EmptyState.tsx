import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
  /** 이모지 또는 아이콘 요소. 장식용이므로 스크린리더에는 노출하지 않는다. */
  icon?: ReactNode;
  /** 한 줄 설명 */
  message: string;
  /** 주요 액션 버튼 (0~2개) */
  actions?: ReactNode;
}

/** 비어 있음 상태 (01-design-system.md §6.7): 일러스트 + 한 줄 설명 + 주요 액션 버튼 */
export function EmptyState({ icon, message, actions }: EmptyStateProps) {
  return (
    <div className={styles.wrap} role="status">
      {icon ? (
        <div className={styles.icon} aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <p className={styles.message}>{message}</p>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  );
}
