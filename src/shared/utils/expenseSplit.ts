/**
 * 경비 정산 계산 — 동행 정산(0053)과 여행 더치페이(0108)가 같이 쓴다.
 * 금액은 통화의 최소 단위(원·엔은 1, 달러는 0.01)로 바꿔 정수로 계산해 합이 정확히 맞고,
 * 나누어 떨어지지 않는 나머지는 사람 id 순서로 앞사람부터 1단위씩 더 부담한다.
 *
 * - `settleExpenses`: 통화별로 따로(환율 변환 없음) "누가 누구에게 얼마" — 동행용
 * - `settleInBase`: 여행 기본 통화로 환산해 한 번에, 이미 보낸 돈(송금 완료)을 반영 — 여행용
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

/** 한 건을 사람별 부담액(최소 단위 정수)으로 나눈다 — 나머지는 id 순서로 앞사람부터 1단위씩 */
function minorShares(minor: number, splitAmong: string[]): Map<string, number> {
  const people = [...new Set(splitAmong)].sort();
  const base = Math.floor(minor / people.length);
  const remainder = minor - base * people.length;
  return new Map(people.map((id, i) => [id, base + (i < remainder ? 1 : 0)]));
}

/** 사람별 순잔액(최소 단위): 양수 = 받을 돈, 음수 = 낼 돈 */
function balancesOf(list: SplitExpense[], scale: number): { balance: Map<string, number>; totalMinor: number } {
  const balance = new Map<string, number>();
  const add = (id: string, v: number) => balance.set(id, (balance.get(id) ?? 0) + v);
  let totalMinor = 0;
  for (const e of list) {
    const minor = Math.round(e.amount * scale);
    totalMinor += minor;
    add(e.payerId, minor);
    minorShares(minor, e.splitAmong).forEach((v, id) => add(id, -v));
  }
  return { balance, totalMinor };
}

/** 받을 사람/낼 사람을 큰 금액부터 짝지어 송금 횟수를 줄인다 */
function pairOff(balance: Map<string, number>, scale: number): Transfer[] {
  const creditors = [...balance].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const debtors = [...balance]
    .filter(([, v]) => v < 0)
    .map(([id, v]) => [id, -v] as [string, number])
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
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
  return transfers;
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
    const { balance, totalMinor } = balancesOf(list, scale);
    result.push({ currency, total: totalMinor / scale, transfers: pairOff(balance, scale) });
  }
  return result;
}

/* ───────────── 여행 더치페이: 기본 통화 환산 + 송금 완료 반영 ───────────── */

export interface TripSplitExpense extends SplitExpense {
  /** 기본 통화가 아닌 통화로 적었을 때, 적을 당시 환율(1 통화 = 몇 기본 통화) */
  fxRateToBase?: number | null;
}

/** 이미 보낸 돈(송금 완료) — 기본 통화 */
export interface PaidTransfer {
  from: string;
  to: string;
  amount: number;
}

export interface BaseSettlement {
  currency: string;
  /** 정산 대상 총액(환산한 합) */
  total: number;
  /** 송금 완료를 반영한 사람별 순잔액: 양수 = 받을 돈, 음수 = 낼 돈 (기본 단위) */
  balances: Record<string, number>;
  /** 아직 남은 송금 */
  transfers: Transfer[];
  /** 환율이 없어 합계에서 뺀 건수 */
  unconverted: number;
}

/** 한 건을 기본 통화 금액으로(최소 단위로 반올림). 환율이 없으면 null */
export function amountInBase(e: { amount: number; currency: string; fxRateToBase?: number | null }, baseCurrency: string): number | null {
  const scale = 10 ** currencyFractionDigits(baseCurrency);
  if (e.currency === baseCurrency) return Math.round(e.amount * scale) / scale;
  const rate = e.fxRateToBase;
  if (!rate || !(rate > 0)) return null;
  return Math.round(e.amount * rate * scale) / scale;
}

/** 한 사람의 부담액(기본 통화). 나눌 사람에 없거나 환산 못 하면 0 */
export function shareInBase(e: TripSplitExpense, userId: string, baseCurrency: string): number {
  const base = amountInBase(e, baseCurrency);
  if (base === null || e.splitAmong.length === 0 || !(base > 0)) return 0;
  const scale = 10 ** currencyFractionDigits(baseCurrency);
  return (minorShares(Math.round(base * scale), e.splitAmong).get(userId) ?? 0) / scale;
}

/**
 * 여행 더치페이 정산: 모두 기본 통화로 환산해 한 번에 계산하고, 이미 보낸 돈은 잔액에 반영한 뒤
 * 남은 송금만 짝짓는다(보낸 사람은 낼 돈이 줄고, 받은 사람은 받을 돈이 준다).
 */
export function settleInBase(expenses: TripSplitExpense[], paid: PaidTransfer[], baseCurrency: string): BaseSettlement {
  const scale = 10 ** currencyFractionDigits(baseCurrency);
  const converted: SplitExpense[] = [];
  let unconverted = 0;
  for (const e of expenses) {
    if (e.splitAmong.length === 0 || !(e.amount > 0)) continue;
    const amount = amountInBase(e, baseCurrency);
    if (amount === null) {
      unconverted += 1;
      continue;
    }
    converted.push({ payerId: e.payerId, amount, currency: baseCurrency, splitAmong: e.splitAmong });
  }

  const { balance, totalMinor } = balancesOf(converted, scale);
  for (const p of paid) {
    const minor = Math.round(p.amount * scale);
    if (!(minor > 0)) continue;
    balance.set(p.from, (balance.get(p.from) ?? 0) + minor);
    balance.set(p.to, (balance.get(p.to) ?? 0) - minor);
  }

  return {
    currency: baseCurrency,
    total: totalMinor / scale,
    balances: Object.fromEntries([...balance].map(([id, v]) => [id, v / scale])),
    transfers: pairOff(balance, scale),
    unconverted,
  };
}
