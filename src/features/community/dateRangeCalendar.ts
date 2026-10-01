import { addMonths, differenceInCalendarDays, format, parseISO, startOfMonth } from 'date-fns';

/** 'yyyy-MM-dd' 문자열 ↔ 그 날 0시(현지)의 Date. 잘못된 값은 null */
export function parseYmd(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = parseISO(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toYmd(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/** 한 달의 달력 칸 — 일요일부터 시작, 앞쪽 빈 칸은 null. 마지막 주는 채우지 않는다 */
export function monthCells(month: Date): (Date | null)[] {
  const first = startOfMonth(month);
  const cells: (Date | null)[] = Array.from({ length: first.getDay() }, () => null);
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  for (let day = 1; day <= days; day += 1) cells.push(new Date(first.getFullYear(), first.getMonth(), day));
  return cells;
}

/** 이번 달부터 count개 달의 첫날 */
export function monthsFrom(start: Date, count: number): Date[] {
  const first = startOfMonth(start);
  return Array.from({ length: count }, (_, i) => addMonths(first, i));
}

/** 출발·복귀 사이의 박·일 수 — 같은 날이면 0박 1일 */
export function tripLength(start: Date, end: Date): { nights: number; days: number } {
  const nights = Math.max(0, differenceInCalendarDays(end, start));
  return { nights, days: nights + 1 };
}

export interface DateRangeValue {
  start: string | null;
  end: string | null;
  /** 날짜 미정(협의) — true면 start·end는 null */
  tbd: boolean;
}

/**
 * 날짜를 눌렀을 때의 다음 선택 — 차례대로 출발일 → 복귀일.
 * 출발일 없이/둘 다 있는 상태에서 누르면 새 출발일, 출발일보다 앞 날을 누르면 그 날이 새 출발일, 같은 날은 당일치기.
 */
export function pickDate(current: { start: string | null; end: string | null }, picked: string): { start: string; end: string | null } {
  if (!current.start || current.end) return { start: picked, end: null };
  if (picked < current.start) return { start: picked, end: null };
  return { start: current.start, end: picked };
}

/** "10.12(토)" — 요일은 화면 언어에 맞춰 짧게 */
export function formatShortDate(date: Date, locale: string): string {
  return `${date.getMonth() + 1}.${date.getDate()}(${weekdayShort(date, locale)})`;
}

/** "2026. 10. 12 (토)" */
export function formatLongDate(date: Date, locale: string): string {
  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()} (${weekdayShort(date, locale)})`;
}

function weekdayShort(date: Date, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date);
  } catch {
    return '';
  }
}
