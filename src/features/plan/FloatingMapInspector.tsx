import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, StickyNote, Navigation, ChevronDown, MapPin } from 'lucide-react';
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

const COLLAPSED_KEY = 'triptic-map-inspector-collapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * 데스크톱 지도에서 선택한 장소 요약 — 사용자가 입력한 정보만 보여준다.
 * 접으면 같은 자리의 작은 동그라미 버튼이 되고(지도를 가리지 않게), 접어 둔 상태는 이 기기에 기억한다.
 */
export function FloatingMapInspector({ title, subtitle, time, memo, onFocusMove }: FloatingMapInspectorProps) {
  const { t } = useTranslation('plan');
  const [collapsed, setCollapsed] = useState(readCollapsed);

  function setCollapsedAndRemember(next: boolean) {
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
    } catch {
      // 저장이 막힌 환경 — 이번 화면에서만 접힌다
    }
  }

  if (collapsed) {
    return (
      <button
        type="button"
        className={styles.collapsedBtn}
        onClick={() => setCollapsedAndRemember(false)}
        aria-label={t('inspector.expand', { name: title })}
        title={title}
      >
        <MapPin size={20} aria-hidden="true" />
      </button>
    );
  }

  return (
    <div className={styles.inspectorCard}>
      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <h4 className={styles.title}>{title}</h4>
            <button type="button" className={styles.collapseBtn} onClick={() => setCollapsedAndRemember(true)} aria-label={t('inspector.collapse')} title={t('inspector.collapse')}>
              <ChevronDown size={18} aria-hidden="true" />
            </button>
          </div>
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
              <div className={`${styles.detailItem} ${styles.detailMemo}`} title={memo}>
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
