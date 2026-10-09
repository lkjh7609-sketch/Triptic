import { describe, expect, it } from 'vitest';
import type { ExpenseItem } from '../types';
import { buildMyExpenses, isMine, isRealSplit, myEntries, splitsAsExpenses, type TripSplitExpense } from './splitModel';
import { getDayExpenseTotal, getGrandExpenseTotal } from '../expenses';

const ME = 'me';
const OWNER = 'owner';

function split(over: Partial<TripSplitExpense>): TripSplitExpense {
  return {
    id: 's1',
    trip_id: 't1',
    day_index: 1,
    category: 'food',
    description: '저녁',
    amount: 10000,
    currency: 'KRW',
    fx_rate_to_base: null,
    payer_id: OWNER,
    split_among: [OWNER, ME],
    created_by: OWNER,
    created_at: '',
    updated_at: '',
    ...over,
  };
}

describe('isMine / myEntries', () => {
  it('낸 사람이 나면 내 것', () => {
    expect(isMine({ desc: 'a', amount: 1, paidBy: ME }, ME, OWNER)).toBe(true);
    expect(isMine({ desc: 'a', amount: 1, paidBy: 'x' }, ME, OWNER)).toBe(false);
  });

  it('낸 사람이 없는 옛 경비는 여행 만든 사람 것', () => {
    expect(isMine({ desc: 'a', amount: 1 }, OWNER, OWNER)).toBe(true);
    expect(isMine({ desc: 'a', amount: 1 }, ME, OWNER)).toBe(false);
  });

  it('내 id를 모르면(로그인 전) 전부 내 것', () => {
    expect(isMine({ desc: 'a', amount: 1, paidBy: 'x' }, null, null)).toBe(true);
  });

  it('내 것만 고르되 원래 목록에서의 순번을 지킨다 — 이 순번으로 지워야 일행 것이 안 지워진다', () => {
    const list: ExpenseItem[] = [
      { desc: '남1', amount: 1, paidBy: 'x' },
      { desc: '내1', amount: 2, paidBy: ME },
      { desc: '남2', amount: 3, paidBy: 'y' },
      { desc: '내2', amount: 4, paidBy: ME },
    ];
    const mine = myEntries(list, ME, OWNER);
    expect(mine.map((e) => e.index)).toEqual([1, 3]);
    // 내 첫 줄(화면 0번)을 지우면 원래 1번이 빠지고 일행 것은 그대로 남는다
    const afterDelete = list.filter((_, i) => i !== mine[0].index);
    expect(afterDelete.map((e) => e.desc)).toEqual(['남1', '남2', '내2']);
  });
});

describe('buildMyExpenses', () => {
  it('더치페이 10,000원을 2명이 나누면 내 지출 5,000원으로 잡히고 더치페이 표시가 붙는다', () => {
    const r = buildMyExpenses({}, [split({})], ME, OWNER, 'KRW');
    expect(r[1]).toHaveLength(1);
    expect(r[1][0].amount).toBe(5000);
    expect(r[1][0].split).toEqual({ id: 's1', people: 2, payerId: OWNER });
    expect(getDayExpenseTotal(r[1], 'KRW').total).toBe(5000);
  });

  it('내가 혼자 쓴 돈 + 내 몫 = 합계, 일행이 쓴 돈은 안 들어간다', () => {
    const data = { 1: [{ desc: '내 커피', amount: 4000, paidBy: ME }, { desc: '일행 커피', amount: 3000, paidBy: 'x' }] };
    const r = buildMyExpenses(data, [split({})], ME, OWNER, 'KRW');
    expect(getGrandExpenseTotal(r, 'KRW').total).toBe(9000);
  });

  it('나눈 사람에 내가 없으면 내 지출이 아니다', () => {
    const r = buildMyExpenses({}, [split({ split_among: [OWNER, 'x'] })], ME, OWNER, 'KRW');
    expect(Object.keys(r)).toHaveLength(0);
  });

  it('일차가 없는 더치페이는 0번 묶음에 들어가 합계에는 잡힌다', () => {
    const r = buildMyExpenses({}, [split({ day_index: null })], ME, OWNER, 'KRW');
    expect(getGrandExpenseTotal(r, 'KRW').total).toBe(5000);
  });

  it('외화는 적을 때 환율로 환산하고, 환율이 없으면 환산 못 한 줄로 센다', () => {
    const withFx = buildMyExpenses({}, [split({ amount: 100, currency: 'USD', fx_rate_to_base: 1400 })], ME, OWNER, 'KRW');
    expect(getDayExpenseTotal(withFx[1], 'KRW')).toEqual({ total: 70000, unconverted: 0 });
    const noFx = buildMyExpenses({}, [split({ amount: 100, currency: 'USD' })], ME, OWNER, 'KRW');
    expect(getDayExpenseTotal(noFx[1], 'KRW')).toEqual({ total: 0, unconverted: 1 });
  });

  it('3명 중 나머지가 생기면 id 순서 몫을 쓴다(정산과 같은 규칙)', () => {
    const s = split({ amount: 10000, split_among: ['a', 'b', 'c'], payer_id: 'a' });
    expect(buildMyExpenses({}, [s], 'a', 'a', 'KRW')[1][0].amount).toBe(3334);
    expect(buildMyExpenses({}, [s], 'c', 'a', 'KRW')[1][0].amount).toBe(3333);
  });

  it('내 id를 모르면 입력을 그대로 돌려준다', () => {
    const data = { 1: [{ desc: 'a', amount: 1 }] };
    expect(buildMyExpenses(data, [split({})], null, null, 'KRW')).toBe(data);
  });
});

describe('splitsAsExpenses / isRealSplit', () => {
  it('더치페이 화면 그래프용으로 총액을 일차별로 묶는다', () => {
    const r = splitsAsExpenses([split({}), split({ id: 's2', day_index: 2, amount: 3000 }), split({ id: 's3', day_index: null, amount: 500 })]);
    expect(r[1][0].amount).toBe(10000);
    expect(r[2][0].amount).toBe(3000);
    expect(r[0][0].amount).toBe(500);
  });

  it('나눈 사람이 낸 사람 한 명뿐이면 더치페이가 아니다', () => {
    expect(isRealSplit('a', ['a'])).toBe(false);
    expect(isRealSplit('a', [])).toBe(false);
    expect(isRealSplit('a', ['b'])).toBe(true); // 대신 계산
    expect(isRealSplit('a', ['a', 'b'])).toBe(true);
  });
});
