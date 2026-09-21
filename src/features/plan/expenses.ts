/**
 * 경비 합계 계산 (index.html renderExpenseSection에서 이식 — ADR-001)
 * 원본: index.html renderExpenseSection (2026-09-20 기준 라인 6096~6132)의 합계 계산
 * 부분만 순수 함수로 분리했다.
 *
 * 02-screens.md §3.7 확장(카테고리·통화·결제수단·환율 자동 변환)은 legacy에
 * 실제 구현된 적이 없어(샘플 데이터에만 category/currency 필드가 있었을 뿐,
 * addExpense()엔 반영 안 됨) 이식이 아니라 신규 작성이다.
 */
import type { ExpenseCategory, ExpenseItem, ExpensePaymentMethod, ExpensesData } from './types';

/** 원본 index.html CURRENCIES (2026-09-20 기준 라인 3615~3620)과 동일 */
export const CURRENCIES: Record<string, { symbol: string; unit: string }> = {
  KRW: { symbol: '₩', unit: '원' },
  JPY: { symbol: '¥', unit: '엔' },
  USD: { symbol: '$', unit: '달러' },
  EUR: { symbol: '€', unit: '유로' },
};

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  food: '식비',
  transport: '교통',
  lodging: '숙박',
  shopping: '쇼핑',
  activity: '액티비티',
  other: '기타',
};

export const PAYMENT_METHOD_LABELS: Record<ExpensePaymentMethod, string> = {
  cash: '현금',
  card: '카드',
  other: '기타',
};

export function formatMoney(amount: number, currency: string): string {
  const num = Number(amount) || 0;
  const meta = CURRENCIES[currency] || CURRENCIES.KRW;
  return `${num.toLocaleString()}${meta.unit}`;
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
): { label: string; value: number }[] {
  const series: { label: string; value: number }[] = [];
  for (let day = 1; day <= totalDays; day++) {
    series.push({ label: `Day ${day}`, value: getDayExpenseTotal(expensesData[day] ?? [], baseCurrency).total });
  }
  return series;
}

/** 카테고리별 합계 차트 데이터 (02-screens.md §3.7 "카테고리별 합계 차트") */
export function getCategoryTotalsSeries(
  expensesData: ExpensesData,
  baseCurrency: string,
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
    .map((cat) => ({ label: EXPENSE_CATEGORY_LABELS[cat], value: totals[cat] }));
}
