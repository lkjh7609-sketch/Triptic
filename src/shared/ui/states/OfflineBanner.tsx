import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import styles from './OfflineBanner.module.css';

interface OfflineBannerProps {
  /** 마지막으로 서버와 동기화된 시각. null이면 "동기화 이력 없음"으로 표시 */
  lastSyncedAt: Date | null;
}

/**
 * 오프라인 상태 (01-design-system.md §6.7): 상단 배너 "오프라인 — 마지막 동기화 N분 전".
 * 읽기는 허용, 쓰기는 큐에 적재한다 (쓰기 큐 자체는 Phase 6 오프라인 캐시 작업 범위).
 */
export function OfflineBanner({ lastSyncedAt }: OfflineBannerProps) {
  const syncedLabel = lastSyncedAt
    ? `마지막 동기화 ${formatDistanceToNow(lastSyncedAt, { addSuffix: true, locale: ko })}`
    : '동기화 이력 없음';

  return (
    <div className={styles.banner} role="status">
      <span aria-hidden="true">📡</span>
      <span>오프라인 — {syncedLabel}</span>
    </div>
  );
}
