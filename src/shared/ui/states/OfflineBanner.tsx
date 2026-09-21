import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import styles from './OfflineBanner.module.css';

interface OfflineBannerProps {
  /** 마지막으로 서버와 동기화된 시각. null이면 "동기화 이력 없음"으로 표시 */
  lastSyncedAt: Date | null;
}

/**
 * 오프라인 상태 (01-design-system.md §6.7): 상단 배너 "오프라인 — 마지막 동기화 N분 전".
 * 읽기는 허용, 쓰기는 큐에 적재한다 (쓰기 큐 자체는 Phase 6 오프라인 캐시 작업 범위).
 * ⚠️ 상대 시각 포매팅(date-fns locale)은 이번 i18n 전환 범위 밖 — Phase6-C에서 다룬다.
 */
export function OfflineBanner({ lastSyncedAt }: OfflineBannerProps) {
  const { t } = useTranslation();
  const syncedLabel = lastSyncedAt
    ? t('offline.lastSynced', { time: formatDistanceToNow(lastSyncedAt, { addSuffix: true, locale: ko }) })
    : t('offline.noHistory');

  return (
    <div className={styles.banner} role="status">
      <span aria-hidden="true">📡</span>
      <span>{t('offline.banner', { label: syncedLabel })}</span>
    </div>
  );
}
