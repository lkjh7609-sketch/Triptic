import { useTranslation } from 'react-i18next';
import { Clock, StickyNote, Navigation } from 'lucide-react';
import styles from './FloatingMapInspector.module.css';

interface FloatingMapInspectorProps {
  title: string;
  subtitle: string;
  /** 사용자가 정한 방문 시각 (없으면 표시 안 함) */
  time?: string;
  /** 사용자가 적은 메모 (없으면 표시 안 함) */
  memo?: string;
  /** 오른쪽 일정 목록에서 이 장소로 스크롤. 숙소처럼 목록 항목이 아니면 생략 */
  onFocusMove?: () => void;
}

/** 데스크톱 지도에서 선택한 장소 요약 — 사용자가 입력한 정보만 보여준다 */
export function FloatingMapInspector({ title, subtitle, time, memo, onFocusMove }: FloatingMapInspectorProps) {
  const { t } = useTranslation('plan');
  return (
    <div className={styles.inspectorCard}>
      <div className={styles.content}>
        <div className={styles.header}>
          <h4 className={styles.title}>{title}</h4>
          <span className={styles.subtitle}>{subtitle}</span>
        </div>

        {time || memo ? (
          <div className={styles.detailsRow}>
            {time ? (
              <div className={styles.detailItem}>
                <Clock size={14} aria-hidden="true" />
                <span>{time}</span>
              </div>
            ) : null}
            {memo ? (
              <div className={styles.detailItem}>
                <StickyNote size={14} aria-hidden="true" />
                <span>{memo}</span>
              </div>
            ) : null}
          </div>
        ) : null}

        {onFocusMove ? (
          <button type="button" className={styles.actionBtn} onClick={onFocusMove}>
            <Navigation size={14} aria-hidden="true" /> {t('inspector.focusMove')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
