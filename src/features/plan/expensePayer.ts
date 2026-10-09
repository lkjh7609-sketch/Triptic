import type { ExpenseItem, ExpensesData } from './types';

/** DB에 저장돼 있는 경비 한 줄(낸 사람이 정해진 것만) — 비교용 */
export interface StoredPayer {
  day_index: number | null;
  description: string;
  amount: number | string;
  category: string | null;
  paid_by: string | null;
}

function keyOf(day: number | null, desc: string, amount: number | string, category: string | null | undefined): string {
  return `${day ?? 0}|${desc}|${Number(amount)}|${category ?? 'other'}`;
}

/**
 * '낸 사람(paidBy)'을 모르는 옛 화면(서비스워커에 남은 옛 번들)이 저장해도 일행의 경비가 여행 만든 사람 것으로 바뀌지 않게,
 * paidBy 없이 들어온 경비를 DB에 이미 있는 같은 줄(일차·내용·금액·분류가 같은 것)의 낸 사람으로 채운다.
 * 같은 줄이 여러 개면 순서대로 하나씩 쓴다. DB에도 낸 사람이 없으면(옛 데이터) 그대로 둔다 = 여행 만든 사람의 지출.
 */
export function carryPaidBy(expenses: ExpensesData, stored: StoredPayer[]): ExpensesData {
  const pool = new Map<string, string[]>();
  for (const s of stored) {
    if (!s.paid_by) continue;
    const key = keyOf(s.day_index, s.description, s.amount, s.category);
    pool.set(key, [...(pool.get(key) ?? []), s.paid_by]);
  }
  if (pool.size === 0) return expenses;

  const next: ExpensesData = {};
  for (const [dayKey, list] of Object.entries(expenses)) {
    const day = Number(dayKey);
    next[day] = list.map((item): ExpenseItem => {
      if (item.paidBy) return item;
      const queue = pool.get(keyOf(day, item.desc, item.amount, item.category));
      const paidBy = queue?.shift();
      return paidBy ? { ...item, paidBy } : item;
    });
  }
  return next;
}
