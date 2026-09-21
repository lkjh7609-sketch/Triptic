import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './DayChips.module.css';

interface DayChipsProps {
  totalDays: number;
  currentDay: number;
  onChange: (day: number) => void;
}

/**
 * Day 칩 (01-design-system.md §6.4)
 * 가로 스크롤 + 스냅. 활성 칩은 선택 시 뷰포트 중앙으로 자동 스크롤.
 * 7일 초과 시에도 페이지네이션 없이 단순 가로 스크롤로 처리한다 (스펙 §6.4).
 */
export function DayChips({ totalDays, currentDay, onChange }: DayChipsProps) {
  const { t } = useTranslation('plan');
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [currentDay]);

  return (
    <div className={styles.row} role="tablist" aria-label={t('day.tablistLabel')}>
      {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => (
        <button
          key={day}
          ref={day === currentDay ? activeRef : undefined}
          type="button"
          role="tab"
          aria-selected={day === currentDay}
          className={`${styles.chip} ${day === currentDay ? styles.active : ''}`}
          onClick={() => onChange(day)}
        >
          {t('day.header', { index: day })}
        </button>
      ))}
    </div>
  );
}
