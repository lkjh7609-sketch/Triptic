/**
 * 동행 경비 정산(0053) — 통화별로 따로(환율 변환 없음) "누가 누구에게 얼마"를 계산한다.
 * 금액은 통화의 최소 단위(원·엔은 1, 달러는 0.01)로 바꿔 정수로 계산해 합이 정확히 맞고,
 * 나누어 떨어지지 않는 나머지는 사람 id 순서로 앞사람부터 1단위씩 더 부담한다.
 */
export interface SplitExpense {
  payerId: string;
  amount: number;
  currency: string;
  splitAmong: string[];
}

export interface Transfer {
  from: string;
  to: string;
  /** 통화 기본 단위(원, 달러) */
  amount: number;
}

export interface CurrencySettlement {
  currency: string;
  total: number;
  transfers: Transfer[];
}

export function currencyFractionDigits(currency: string): number {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

export function settleExpenses(expenses: SplitExpense[]): CurrencySettlement[] {
  const byCurrency = new Map<string, SplitExpense[]>();
  for (const e of expenses) {
    if (e.splitAmong.length === 0 || !(e.amount > 0)) continue;
    byCurrency.set(e.currency, [...(byCurrency.get(e.currency) ?? []), e]);
  }

  const result: CurrencySettlement[] = [];
  for (const [currency, list] of [...byCurrency.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const scale = 10 ** currencyFractionDigits(currency);
    const balance = new Map<string, number>();
    const add = (id: string, v: number) => balance.set(id, (balance.get(id) ?? 0) + v);
    let totalMinor = 0;

    for (const e of list) {
      const minor = Math.round(e.amount * scale);
      totalMinor += minor;
      add(e.payerId, minor);
      const people = [...new Set(e.splitAmong)].sort();
      const base = Math.floor(minor / people.length);
      const remainder = minor - base * people.length;
      people.forEach((id, i) => add(id, -(base + (i < remainder ? 1 : 0))));
    }

    // 받을 사람/낼 사람을 큰 금액부터 짝지어 송금 횟수를 줄인다
    const creditors = [...balance].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const debtors = [...balance].filter(([, v]) => v < 0).map(([id, v]) => [id, -v] as [string, number]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const transfers: Transfer[] = [];
    let i = 0;
    let j = 0;
    while (i < creditors.length && j < debtors.length) {
      const pay = Math.min(creditors[i][1], debtors[j][1]);
      transfers.push({ from: debtors[j][0], to: creditors[i][0], amount: pay / scale });
      creditors[i][1] -= pay;
      debtors[j][1] -= pay;
      if (creditors[i][1] === 0) i += 1;
      if (debtors[j][1] === 0) j += 1;
    }
    result.push({ currency, total: totalMinor / scale, transfers });
  }
  return result;
}
