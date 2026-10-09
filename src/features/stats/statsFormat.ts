import { formatMoney, formatMoneyCompact } from '@/features/plan/expenses';

/** 원화 금액 — 크면 '1,234만원'처럼 줄여서(언어별 표기는 formatMoneyCompact) */
export function krw(amount: number, language: string, compact = false): string {
  const rounded = Math.round(amount);
  return compact ? formatMoneyCompact(rounded, 'KRW', language) : formatMoney(rounded, 'KRW', language);
}

export function num(n: number, language: string, maxFraction = 0): string {
  return new Intl.NumberFormat(language, { maximumFractionDigits: maxFraction }).format(n);
}

/** 나라 코드 → 표시 언어 이름 */
export function countryName(code: string, language: string): string {
  try {
    return new Intl.DisplayNames([language], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** 도넛·누적 막대에 쓰는 색 — 브랜드 초록 계열 + 호박색 한 가지 */
export const CHART_COLORS = ['#2E4F4F', '#3F8F86', '#8FBFB4', '#D97706', '#B08968', '#A8A29E'];

export function shortDate(iso: string, language: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return new Intl.DateTimeFormat(language, { year: 'numeric', month: 'short', day: 'numeric' }).format(d);
}

export function dateRange(start: string, end: string, language: string): string {
  return `${shortDate(start, language)} ~ ${shortDate(end, language)}`;
}
