import styles from './ErrorState.module.css';

interface ErrorStateProps {
  /** 원인 요약 (사용자가 이해할 수 있는 한 문장) */
  summary: string;
  onRetry?: () => void;
  retryLabel?: string;
  /** 고객센터 링크 (필요 시) */
  supportHref?: string;
  supportLabel?: string;
}

/** 오류 상태 (01-design-system.md §6.7): 원인 요약 + "다시 시도" + (필요 시) 고객센터 링크 */
export function ErrorState({
  summary,
  onRetry,
  retryLabel = '다시 시도',
  supportHref,
  supportLabel = '문의하기',
}: ErrorStateProps) {
  return (
    <div className={styles.wrap} role="alert">
      <p className={styles.summary}>{summary}</p>
      {onRetry ? (
        <button type="button" className={styles.retry} onClick={onRetry}>
          {retryLabel}
        </button>
      ) : null}
      {supportHref ? (
        <a className={styles.supportLink} href={supportHref}>
          {supportLabel}
        </a>
      ) : null}
    </div>
  );
}
