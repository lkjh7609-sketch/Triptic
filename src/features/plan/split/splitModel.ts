import type { ExpenseCategory, ExpenseItem, ExpensesData } from '../types';
import { amountInBase, shareInBase, type TripSplitExpense as SplitCalcExpense } from '@/shared/utils/expenseSplit';

/** 0108 trip_split_expenses 행 */
export interface TripSplitExpense {
  id: string;
  trip_id: string;
  /** 몇 일차(1부터), 정해지지 않았으면 null */
  day_index: number | null;
  category: ExpenseCategory;
  description: string;
  amount: number;
  currency: string;
  fx_rate_to_base: number | null;
  payer_id: string;
  split_among: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** 0108 trip_split_transfers 행 — 송금 완료 기록(여행 기본 통화) */
export interface TripSplitTransfer {
  id: string;
  trip_id: string;
  from_user: string;
  to_user: string;
  amount: number;
  currency: string;
  created_by: string | null;
  created_at: string;
}

/** 더치페이 화면·선택 칸에 보이는 사람 */
export interface Person {
  id: string;
  name: string | null;
  /** 도트 캐릭터를 정하는 값 — 본인이 고른 값이 있으면 그것, 없으면 사용자 ID */
  seed: string;
  /** 지금은 여행 멤버가 아닌 사람(나간 일행) */
  left: boolean;
}

/** 경비 화면 목록에 섞이는 '내 더치페이 몫' 줄 — 저장되지 않는 표시용 */
export interface MyExpenseItem extends ExpenseItem {
  split?: { id: string; people: number; payerId: string };
}

/** 이 경비가 내 지출인가: 낸 사람이 나, 또는 낸 사람이 없는 옛 데이터인데 내가 여행을 만든 사람. 로그인 전(meId 없음)은 전부 내 것 */
export function isMine(item: ExpenseItem, meId: string | null, ownerId: string | null): boolean {
  if (!meId) return true;
  return (item.paidBy ?? ownerId) === meId;
}

/** 그날 경비 중 내 것만, 원래 목록에서의 순번과 함께 — 지우기·저장은 이 순번으로 해야 일행 것이 안 지워진다 */
export function myEntries(list: ExpenseItem[], meId: string | null, ownerId: string | null): { item: ExpenseItem; index: number }[] {
  return list.map((item, index) => ({ item, index })).filter((e) => isMine(e.item, meId, ownerId));
}

/** 나눈 사람에 내가 들어 있는 더치페이의 내 몫 — 기본 통화로 환산. 환율이 없으면 환산 못 한 줄로(합계에서 빠지고 건수로 센다) */
function shareItem(s: TripSplitExpense, meId: string, baseCurrency: string): MyExpenseItem {
  const common = {
    desc: s.description,
    category: s.category,
    split: { id: s.id, people: new Set(s.split_among).size, payerId: s.payer_id },
  };
  const calc = toCalc(s);
  if (amountInBase(calc, baseCurrency) === null) {
    return { ...common, amount: s.amount / common.split.people, currency: s.currency, fxRateToBase: null };
  }
  return { ...common, amount: shareInBase(calc, meId, baseCurrency), currency: baseCurrency };
}

function toCalc(s: TripSplitExpense): SplitCalcExpense {
  return { payerId: s.payer_id, amount: s.amount, currency: s.currency, fxRateToBase: s.fx_rate_to_base, splitAmong: s.split_among };
}

/**
 * 경비 화면·하루 요약·합계·그래프가 쓰는 '내 지출': 내가 혼자 쓴 돈 + 내가 나눈 더치페이의 내 몫.
 * 더치페이는 일차가 없으면 0번 묶음(합계·분류 그래프에는 들어가고 일자 그래프에는 안 나온다).
 * 로그인 전·임시 여행처럼 내 id를 모르면 입력을 그대로 돌려준다.
 */
export function buildMyExpenses(
  expensesData: ExpensesData,
  splits: TripSplitExpense[],
  meId: string | null,
  ownerId: string | null,
  baseCurrency: string,
): Record<number, MyExpenseItem[]> {
  if (!meId) return expensesData;
  const out: Record<number, MyExpenseItem[]> = {};
  for (const [dayKey, list] of Object.entries(expensesData)) {
    const mine = list.filter((item) => isMine(item, meId, ownerId));
    if (mine.length > 0) out[Number(dayKey)] = mine;
  }
  for (const s of splits) {
    if (!s.split_among.includes(meId)) continue;
    const day = s.day_index ?? 0;
    (out[day] ??= []).push(shareItem(s, meId, baseCurrency));
  }
  return out;
}

/** 더치페이 화면의 그래프용 — 함께 쓴 돈 전체(내 몫이 아니라 총액)를 경비 그래프가 읽는 모양으로 */
export function splitsAsExpenses(splits: TripSplitExpense[]): ExpensesData {
  const out: ExpensesData = {};
  for (const s of splits) {
    (out[s.day_index ?? 0] ??= []).push({
      desc: s.description,
      amount: s.amount,
      currency: s.currency,
      category: s.category,
      fxRateToBase: s.fx_rate_to_base,
    });
  }
  return out;
}

/** 정산 계산기가 읽는 모양으로 */
export function toCalcExpenses(splits: TripSplitExpense[]): SplitCalcExpense[] {
  return splits.map(toCalc);
}

/** 나눈 사람 수가 1명이고 그게 낸 사람이면 '혼자 쓴 돈'이라 더치페이가 아니다 */
export function isRealSplit(payerId: string, splitAmong: string[]): boolean {
  const people = new Set(splitAmong);
  if (people.size === 0) return false;
  return !(people.size === 1 && people.has(payerId));
}
