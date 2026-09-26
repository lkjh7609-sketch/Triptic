/**
 * 경비 합계 계산 (index.html renderExpenseSection에서 이식 — ADR-001)
 * 원본: index.html renderExpenseSection (2026-09-20 기준 라인 6096~6132)의 합계 계산
 * 부분만 순수 함수로 분리했다.
 *
 * 02-screens.md §3.7 확장(카테고리·통화·결제수단·환율 자동 변환)은 legacy에
 * 실제 구현된 적이 없어(샘플 데이터에만 category/currency 필드가 있었을 뿐,
 * addExpense()엔 반영 안 됨) 이식이 아니라 신규 작성이다.
 */
import type { ExpenseCategory, ExpenseItem, ExpensesData } from './types';
import { CURRENCY_SYMBOLS, SUPPORTED_CURRENCIES } from './currencies';

/** 지원 통화(currencies.ts) → { symbol }. 이름은 currencyName()으로 표시 언어에 맞춰 만든다 */
export const CURRENCIES: Record<string, { symbol: string }> = Object.fromEntries(
  SUPPORTED_CURRENCIES.map((code) => [code, { symbol: CURRENCY_SYMBOLS[code] }]),
);

/** 통화 이름 ("일본 엔", "Japanese Yen", "日圓", "日本円") — Intl.DisplayNames 사용 */
export function currencyName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'currency' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** 경비 카테고리 순서(표시 이름은 plan:expense.category.* 번역 키) */
export const EXPENSE_CATEGORIES: ExpenseCategory[] = ['food', 'transport', 'lodging', 'shopping', 'activity', 'other'];

/**
 * 금액을 통화 기호와 함께 표시한다 (07-i18n.md §5.2 — Intl.NumberFormat 경유,
 * 직접 포매팅하지 않는다). locale은 i18n.language를 그대로 넘기면 된다
 * (SupportedLocale 'ko'/'en'/'zh-TW'/'ja' 모두 Intl.NumberFormat이 그대로 받아들이는
 * 유효한 BCP47 태그다). 알 수 없는 통화 코드는 기존 동작과 동일하게 KRW로 폴백한다.
 */
export function formatMoney(amount: number, currency: string, locale: string = 'ko'): string {
  const num = Number(amount) || 0;
  const validCurrency = CURRENCIES[currency] ? currency : 'KRW';
  return new Intl.NumberFormat(locale, { style: 'currency', currency: validCurrency }).format(num);
}

/** 환율 표시용 — 1 JPY = ₩9.0123처럼 작은 값도 의미 있게 보이도록 소수점을 더 둔다 */
export function formatRate(value: number, currency: string, locale: string = 'ko'): string {
  const validCurrency = CURRENCIES[currency] ? currency : 'KRW';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: validCurrency,
    minimumFractionDigits: 0,
    maximumFractionDigits: value < 10 ? 4 : 2,
  }).format(value);
}

/**
 * 항목 금액을 여행 기본 통화로 환산한다. 통화가 같으면 그대로, 다르면 입력
 * 시점에 저장해둔 fxRateToBase 스냅샷으로만 계산한다(현재 환율로 재계산하지
 * 않음 — 스펙 원문 요구사항). 스냅샷이 없으면(조회 실패) null.
 */
export function convertToBase(item: ExpenseItem, baseCurrency: string): number | null {
  const amount = Number(item.amount) || 0;
  const currency = item.currency ?? baseCurrency;
  if (currency === baseCurrency) return amount;
  if (item.fxRateToBase == null) return null;
  return amount * item.fxRateToBase;
}

export interface ExpenseTotal {
  /** 기본 통화로 환산 가능했던 항목들의 합계 */
  total: number;
  /** 환율 스냅샷이 없어 합계에서 제외된 항목 수 */
  unconverted: number;
}

export function getDayExpenseTotal(list: ExpenseItem[], baseCurrency: string): ExpenseTotal {
  let total = 0;
  let unconverted = 0;
  for (const item of list) {
    const converted = convertToBase(item, baseCurrency);
    if (converted == null) unconverted += 1;
    else total += converted;
  }
  return { total, unconverted };
}

export function getGrandExpenseTotal(expensesData: ExpensesData, baseCurrency: string): ExpenseTotal {
  let total = 0;
  let unconverted = 0;
  Object.keys(expensesData).forEach((d) => {
    const dayTotal = getDayExpenseTotal(expensesData[Number(d)] ?? [], baseCurrency);
    total += dayTotal.total;
    unconverted += dayTotal.unconverted;
  });
  return { total, unconverted };
}

/** 일자별 합계 차트 데이터 (02-screens.md §3.7 "일자별 합계 차트") */
export function getDayTotalsSeries(
  expensesData: ExpensesData,
  totalDays: number,
  baseCurrency: string,
  /** 라벨 포맷터 — 호출부가 번역된 "Day N" 문구를 넘길 수 있게 한다(07-i18n.md §2.2). 기본값은 기존 동작 유지 */
  dayLabel: (day: number) => string = (day) => `Day ${day}`,
): { label: string; value: number }[] {
  const series: { label: string; value: number }[] = [];
  for (let day = 1; day <= totalDays; day++) {
    series.push({ label: dayLabel(day), value: getDayExpenseTotal(expensesData[day] ?? [], baseCurrency).total });
  }
  return series;
}

/** 카테고리별 합계 차트 데이터 (02-screens.md §3.7 "카테고리별 합계 차트") */
export function getCategoryTotalsSeries(
  expensesData: ExpensesData,
  baseCurrency: string,
  /** 라벨 포맷터 — 호출부가 번역된 카테고리명을 넘긴다(plan:expense.category.*) */
  categoryLabel: (category: ExpenseCategory) => string,
): { label: string; value: number }[] {
  const totals: Record<ExpenseCategory, number> = {
    food: 0,
    transport: 0,
    lodging: 0,
    shopping: 0,
    activity: 0,
    other: 0,
  };
  Object.values(expensesData).forEach((list) => {
    list.forEach((item) => {
      const converted = convertToBase(item, baseCurrency);
      if (converted == null) return;
      const category = item.category ?? 'other';
      totals[category] += converted;
    });
  });
  return (Object.keys(totals) as ExpenseCategory[])
    .filter((cat) => totals[cat] > 0)
    .map((cat) => ({ label: categoryLabel(cat), value: totals[cat] }));
}
