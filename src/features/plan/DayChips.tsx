import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { addDays, parseISO } from 'date-fns';
import { formatShortDate } from './planDateFormat';
import styles from './DayChips.module.css';

interface DayChipsProps {
  totalDays: number;
  currentDay: number;
  onChange: (day: number) => void;
  /** 여행 시작일(yyyy-MM-dd) — 있으면 카드에 날짜(10/14)를 보여준다 */
  startDate?: string | null;
  /** 일차별 장소 수(index 0 = 1일차) — 있으면 카드 아래에 점으로 보여준다(빈 날은 점선) */
  placeCounts?: number[];
}

const MAX_DOTS = 5;

/**
 * 일차 선택 스트립 (01-design-system.md §6.4)
 * 일차 번호만 있는 같은 폭의 알약 대신, 날짜와 그날 장소 수(점)를 담은 카드가 가로로 스크롤된다.
 * 4일 이하면 카드가 폭을 나눠 채우고, 그보다 길면 줄이 늘지 않고 옆으로 넘긴다.
 * 선택한 카드는 화면 가운데로 자동 스크롤된다.
 */
export function DayChips({ totalDays, currentDay, onChange, startDate, placeCounts }: DayChipsProps) {
  const { t, i18n } = useTranslation('plan');
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [currentDay]);

  const start = startDate ? parseISO(startDate) : null;

  return (
    <div className={styles.row} role="tablist" aria-label={t('day.tablistLabel')}>
      {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
        const date = start && !Number.isNaN(start.getTime()) ? formatShortDate(addDays(start, day - 1), i18n.language) : '';
        const count = placeCounts?.[day - 1];
        const selected = day === currentDay;
        return (
          <button
            key={day}
            ref={selected ? activeRef : undefined}
            type="button"
            role="tab"
            aria-selected={selected}
            className={`${styles.chip} ${selected ? styles.active : ''}`}
            onClick={() => onChange(day)}
          >
            <span className={styles.dayLabel}>{t('day.header', { index: day })}</span>
            {date ? <span className={styles.date}>{date}</span> : null}
            {count === undefined ? null : count > 0 ? (
              <span className={styles.dots} aria-hidden="true">
                {Array.from({ length: Math.min(count, MAX_DOTS) }, (_, i) => (
                  <span key={i} className={styles.dot} />
                ))}
              </span>
            ) : (
              <span className={styles.emptyMark} aria-hidden="true" />
            )}
          </button>
        );
      })}
    </div>
  );
}
