/**
 * 경비 합계 계산 (index.html renderExpenseSection에서 이식 — ADR-001)
 * 원본: index.html renderExpenseSection (2026-09-20 기준 라인 6096~6132)의 합계 계산
 * 부분만 순수 함수로 분리했다.
 */
import type { ExpenseItem, ExpensesData } from './types';

/** 원본 index.html CURRENCIES (2026-09-20 기준 라인 3615~3620)과 동일 */
export const CURRENCIES: Record<string, { symbol: string; unit: string }> = {
  KRW: { symbol: '₩', unit: '원' },
  JPY: { symbol: '¥', unit: '엔' },
  USD: { symbol: '$', unit: '달러' },
  EUR: { symbol: '€', unit: '유로' },
};

export function formatMoney(amount: number, currency: string): string {
  const num = Number(amount) || 0;
  const meta = CURRENCIES[currency] || CURRENCIES.KRW;
  return `${num.toLocaleString()}${meta.unit}`;
}

export function getDayExpenseTotal(list: ExpenseItem[]): number {
  return list.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
}

export function getGrandExpenseTotal(expensesData: ExpensesData): number {
  let grandTotal = 0;
  Object.keys(expensesData).forEach((d) => {
    (expensesData[Number(d)] || []).forEach((e) => {
      grandTotal += Number(e.amount) || 0;
    });
  });
  return grandTotal;
}
