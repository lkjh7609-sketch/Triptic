import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, Check, ChevronLeft, ChevronRight, RotateCcw, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { startOfDay } from 'date-fns';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import {
  formatLongDate,
  formatShortDate,
  monthCells,
  monthsFrom,
  parseYmd,
  pickDate,
  toYmd,
  tripLength,
  type DateRangeValue,
} from './dateRangeCalendar';
import styles from './DateRangeDialog.module.css';

const CLOSE_MS = 200;
/** 오늘이 든 달부터 몇 달까지 고를 수 있는가 */
const MONTHS_AHEAD = 18;

interface DateRangeDialogProps {
  /** 지금 골라 둔 일정 — 처음 선택 상태로 보인다 */
  value: DateRangeValue;
  onConfirm: (value: DateRangeValue) => void;
  onClose: () => void;
}

/**
 * 여행 일정 선택 — PC는 두 달을 나란히 둔 가운데 창, 모바일은 같은 내용의 하단 시트(달은 세로로 이어짐).
 * 출발일·복귀일을 차례로 누르고, 날짜를 못 정했으면 "날짜 미정 / 협의 가능"을 켠다. 지난 날짜는 고를 수 없다.
 * 배경을 눌러도 닫히지 않고 닫기 버튼·Esc로만 닫힌다. "선택 완료"를 눌러야 반영된다.
 */
export function DateRangeDialog({ value, onConfirm, onClose }: DateRangeDialogProps) {
  const { t, i18n } = useTranslation('community');
  const desktop = useMediaQuery('(min-width: 1024px)');
  const locale = i18n.language;
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);
  const [start, setStart] = useState<string | null>(value.start);
  const [end, setEnd] = useState<string | null>(value.end);
  const [tbd, setTbd] = useState(value.tbd);

  const today = useMemo(() => startOfDay(new Date()), []);
  const todayYmd = toYmd(today);
  const months = useMemo(() => monthsFrom(today, MONTHS_AHEAD), [today]);
  // PC: 지금 보이는 왼쪽 달의 위치(두 달씩 보인다). 이미 고른 출발일이 있으면 그 달에서 시작
  const [offset, setOffset] = useState(() => {
    const picked = parseYmd(value.start);
    if (!picked) return 0;
    const gap = (picked.getFullYear() - today.getFullYear()) * 12 + picked.getMonth() - today.getMonth();
    return Math.min(Math.max(0, gap), MONTHS_AHEAD - 2);
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  function requestClose(after?: () => void) {
    if (closing) return;
    setClosing(true);
    closeTimer.current = window.setTimeout(() => {
      after?.();
      onClose();
    }, CLOSE_MS);
  }
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);
  const trapRef = useFocusTrap<HTMLDivElement>(() => requestClose());

  // 모바일: 고른 출발일이 있으면 그 달이 보이는 위치로 스크롤
  useEffect(() => {
    if (desktop || !value.start) return;
    const box = scrollRef.current;
    const target = box?.querySelector<HTMLElement>('[data-month-start="true"]');
    if (box && target) box.scrollTop = Math.max(0, target.offsetTop - box.offsetTop);
  }, [desktop, value.start]);

  const startDate = parseYmd(start);
  const endDate = parseYmd(end);
  const hasRange = !!startDate && !!endDate;
  const length = hasRange ? tripLength(startDate, endDate) : null;
  const lengthText = length ? (length.nights === 0 ? t('dateDialog.sameDay') : t('dateDialog.length', { nights: length.nights, days: length.days })) : '';

  const weekdays = useMemo(() => {
    const sunday = new Date(2023, 0, 1);
    return Array.from({ length: 7 }, (_, i) => {
      try {
        return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(sunday.getFullYear(), 0, 1 + i));
      } catch {
        return '';
      }
    });
  }, [locale]);

  function monthLabel(month: Date): string {
    try {
      return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(month);
    } catch {
      return `${month.getFullYear()}-${month.getMonth() + 1}`;
    }
  }

  function dayLabel(day: Date): string {
    try {
      return new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(day);
    } catch {
      return toYmd(day);
    }
  }

  function handlePick(ymd: string) {
    const next = pickDate({ start, end }, ymd);
    setStart(next.start);
    setEnd(next.end);
    setTbd(false);
  }

  function toggleTbd() {
    if (tbd) {
      setTbd(false);
      return;
    }
    setTbd(true);
    setStart(null);
    setEnd(null);
  }

  function reset() {
    setStart(null);
    setEnd(null);
    setTbd(false);
  }

  const canConfirm = hasRange || tbd;
  function handleConfirm() {
    if (!canConfirm) return;
    const result: DateRangeValue = tbd ? { start: null, end: null, tbd: true } : { start, end, tbd: false };
    requestClose(() => onConfirm(result));
  }

  const confirmLabel = tbd
    ? t('dateDialog.confirmTbd')
    : hasRange
      ? t('dateDialog.confirmRange', { range: `${formatShortDate(startDate, locale)} - ${formatShortDate(endDate, locale)}`, length: lengthText })
      : t('dateDialog.confirmNone');

  function renderMonth(month: Date, key: string, isStartMonth = false) {
    const cells = monthCells(month);
    return (
      <div key={key} className={styles.month} role="group" aria-label={monthLabel(month)} data-month-start={isStartMonth ? 'true' : undefined}>
        <h3 className={styles.monthTitle}>{monthLabel(month)}</h3>
        <div className={styles.weekdays} aria-hidden="true">
          {weekdays.map((w, i) => (
            <span key={i} className={`${styles.weekday} ${i === 0 ? styles.sun : ''} ${i === 6 ? styles.sat : ''}`}>
              {w}
            </span>
          ))}
        </div>
        <div className={styles.days}>
          {cells.map((day, i) => {
            if (!day) return <span key={`b${i}`} />;
            const ymd = toYmd(day);
            const isStart = ymd === start;
            const isEnd = ymd === end;
            const inside = !!start && !!end && ymd > start && ymd < end;
            const past = ymd < todayYmd;
            const classes = [
              styles.day,
              day.getDay() === 0 ? styles.sun : '',
              day.getDay() === 6 ? styles.sat : '',
              inside ? styles.inside : '',
              isStart && end && end > ymd ? styles.stripRight : '',
              isEnd && start && start < ymd ? styles.stripLeft : '',
              isStart || isEnd ? styles.picked : '',
              tbd ? styles.dim : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <button
                key={ymd}
                type="button"
                className={classes}
                disabled={past}
                aria-label={dayLabel(day)}
                aria-pressed={isStart || isEnd}
                onClick={() => handlePick(ymd)}
              >
                <span className={styles.dayInner}>
                  <span className={styles.dayNum}>{day.getDate()}</span>
                  {isStart || isEnd ? <span className={styles.mark}>{isStart ? t('dateDialog.markStart') : t('dateDialog.markEnd')}</span> : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const pcMonths = months.slice(offset, offset + 2);
  const startMonthIdx = startDate ? months.findIndex((m) => m.getFullYear() === startDate.getFullYear() && m.getMonth() === startDate.getMonth()) : -1;

  return createPortal(
    <div className={`${styles.overlay} ${closing ? styles.overlayOut : ''}`}>
      <div
        ref={trapRef}
        className={`${styles.panel} ${styles.wide} ${closing ? styles.panelOut : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="date-range-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.handle} aria-hidden="true" />
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <span className={styles.headerIcon}>
              <Calendar size={18} aria-hidden="true" />
            </span>
            <div className={styles.headerText}>
              <h2 id="date-range-title" className={styles.title}>
                {t('dateDialog.title')}
              </h2>
              <p className={styles.sub}>{t('dateDialog.sub')}</p>
            </div>
          </div>
          <div className={styles.headerActions}>
            <button type="button" className={`${styles.tbdBtn} ${tbd ? styles.tbdOn : ''}`} aria-pressed={tbd} onClick={toggleTbd}>
              {t('dateDialog.tbd')}
            </button>
            <button type="button" className={styles.iconBtn} onClick={() => requestClose()} aria-label={t('picker.close')}>
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className={styles.summary}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>{t('dateDialog.startLabel')}</span>
              <span className={`${styles.summaryValue} ${startDate ? '' : styles.summaryEmpty}`}>
                <span className={`${styles.dot} ${startDate ? styles.dotOn : ''}`} aria-hidden="true" />
                {startDate ? formatLongDate(startDate, locale) : t('dateDialog.pickDate')}
              </span>
            </div>
            <span className={`${styles.lengthPill} ${length ? '' : styles.lengthEmpty}`} aria-live="polite">
              {length ? lengthText : '·  ·  ·'}
            </span>
            <div className={`${styles.summaryItem} ${styles.summaryEnd}`}>
              <span className={styles.summaryLabel}>{t('dateDialog.endLabel')}</span>
              <span className={`${styles.summaryValue} ${endDate ? '' : styles.summaryEmpty}`}>
                <span className={`${styles.dot} ${endDate ? styles.dotOn : ''}`} aria-hidden="true" />
                {endDate ? formatLongDate(endDate, locale) : t('dateDialog.pickDate')}
              </span>
            </div>
          </div>
        </div>

        {desktop ? (
          <div className={styles.calendarPc}>
            <button
              type="button"
              className={`${styles.nav} ${styles.navPrev}`}
              disabled={offset <= 0}
              onClick={() => setOffset((n) => Math.max(0, n - 1))}
              aria-label={t('dateDialog.prevMonth')}
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`${styles.nav} ${styles.navNext}`}
              disabled={offset >= MONTHS_AHEAD - 2}
              onClick={() => setOffset((n) => Math.min(MONTHS_AHEAD - 2, n + 1))}
              aria-label={t('dateDialog.nextMonth')}
            >
              <ChevronRight size={20} aria-hidden="true" />
            </button>
            <div className={styles.monthsPc}>{pcMonths.map((m) => renderMonth(m, `${m.getFullYear()}-${m.getMonth()}`))}</div>
          </div>
        ) : (
          <div ref={scrollRef} className={styles.calendarMobile}>
            {months.map((m, i) => renderMonth(m, `${m.getFullYear()}-${m.getMonth()}`, i === startMonthIdx))}
          </div>
        )}

        <div className={styles.footer}>
          <button type="button" className={styles.resetBtn} onClick={reset}>
            <RotateCcw size={15} aria-hidden="true" />
            {t('dateDialog.reset')}
          </button>
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={() => requestClose()}>
              {t('picker.close')}
            </button>
            <button type="button" className={styles.primary} disabled={!canConfirm} onClick={handleConfirm}>
              <span className={styles.primaryText}>{confirmLabel}</span>
              {canConfirm ? <Check size={16} aria-hidden="true" /> : null}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
