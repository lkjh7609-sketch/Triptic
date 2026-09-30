import { useEffect, useRef, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { addDays, format, getDate, parseISO } from 'date-fns';
import { DATE_FNS_LOCALE, formatShortDate } from './planDateFormat';
import styles from './DayChips.module.css';

interface DayChipsProps {
  totalDays: number;
  currentDay: number;
  onChange: (day: number) => void;
  /** 여행 시작일(yyyy-MM-dd) — 있으면 요일·날짜를 보여준다(없으면 Day 번호) */
  startDate?: string | null;
  /** 일차별 장소 수(index 0 = 1일차) — 있으면 일정이 있는 날은 채운 점, 빈 날은 속 빈 점 */
  placeCounts?: number[];
}

/**
 * 일차 선택 — 날짜마다 알약/카드를 늘어놓는 대신, 한 줄로 이어진 선 위에 날짜마다 점을 찍는다.
 * 선택한 날까지 선이 브랜드색으로 차오르고(애니메이션), 선택한 점은 커지며 후광이 생긴다.
 * 일정이 있는 날은 채운 점, 비어 있는 날은 속 빈 점. 열 하나 최소 44px(눌리는 영역)이라
 * 8일까지는 한 화면에 다 들어가고, 그보다 길면 옆으로 넘긴다. 선택한 날은 자동으로 가운데로 스크롤된다.
 */
export function DayChips({ totalDays, currentDay, onChange, startDate, placeCounts }: DayChipsProps) {
  const { t, i18n } = useTranslation('plan');
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [currentDay]);

  const start = startDate ? parseISO(startDate) : null;
  const hasDates = start !== null && !Number.isNaN(start.getTime());
  const locale = DATE_FNS_LOCALE[i18n.language] ?? DATE_FNS_LOCALE.ko;
  const trackStyle = {
    '--n': totalDays,
    // 선이 채워지는 비율: 첫 점 0, 마지막 점 1
    '--progress': totalDays > 1 ? (currentDay - 1) / (totalDays - 1) : 0,
  } as CSSProperties;

  return (
    <div className={styles.row} role="tablist" aria-label={t('day.tablistLabel')}>
      <div className={styles.track} style={trackStyle}>
        <div className={styles.line} aria-hidden="true">
          <div className={styles.fill} />
        </div>
        {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
          const selected = day === currentDay;
          const date = hasDates ? addDays(start, day - 1) : null;
          // 첫날과 매달 1일은 월/일(10/14, 11/1), 나머지는 일자만
          const number = date ? (day === 1 || getDate(date) === 1 ? formatShortDate(date, i18n.language) : String(getDate(date))) : String(day);
          const top = date ? format(date, 'EEE', { locale }) : t('day.header', { index: '' }).trim();
          const filled = (placeCounts?.[day - 1] ?? 0) > 0;
          return (
            <button
              key={day}
              ref={selected ? activeRef : undefined}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-label={date ? `${t('day.header', { index: day })} · ${formatShortDate(date, i18n.language)}` : t('day.header', { index: day })}
              className={`${styles.day} ${selected ? styles.selected : ''}`}
              onClick={() => onChange(day)}
            >
              <span className={styles.top}>{top}</span>
              <span className={styles.number}>{number}</span>
              <span className={styles.nodeRow}>
                <span className={`${styles.node} ${filled ? styles.filled : styles.hollow}`} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
