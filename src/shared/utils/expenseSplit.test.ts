import { describe, expect, it } from 'vitest';
import { settleExpenses } from './expenseSplit';

describe('settleExpenses', () => {
  it('세 명, 결제자가 섞여도 통화별로 최소 송금', () => {
    const result = settleExpenses([
      { payerId: 'a', amount: 30000, currency: 'KRW', splitAmong: ['a', 'b', 'c'] }, // 각 10000
      { payerId: 'b', amount: 15000, currency: 'KRW', splitAmong: ['a', 'b', 'c'] }, // 각 5000
    ]);
    // a: +30000-15000 = +15000, b: +15000-15000 = 0, c: -15000
    expect(result).toEqual([{ currency: 'KRW', total: 45000, transfers: [{ from: 'c', to: 'a', amount: 15000 }] }]);
  });

  it('원은 1원 단위, 나머지는 id 순서로 1원씩 더 부담 — 합이 정확히 맞는다', () => {
    const [krw] = settleExpenses([{ payerId: 'a', amount: 10000, currency: 'KRW', splitAmong: ['c', 'a', 'b'] }]);
    // 3333.33… → a가 3334, b·c가 3333
    expect(krw.transfers).toEqual([
      { from: 'b', to: 'a', amount: 3333 },
      { from: 'c', to: 'a', amount: 3333 },
    ]);
  });

  it('달러는 센트 단위로, 통화끼리 섞지 않는다', () => {
    const result = settleExpenses([
      { payerId: 'a', amount: 10, currency: 'USD', splitAmong: ['a', 'b', 'c'] },
      { payerId: 'b', amount: 900, currency: 'JPY', splitAmong: ['a', 'b'] },
    ]);
    expect(result.map((r) => r.currency)).toEqual(['JPY', 'USD']);
    expect(result[0].transfers).toEqual([{ from: 'a', to: 'b', amount: 450 }]);
    // 1000센트 / 3 = 333 나머지 1 → a가 334센트 부담
    expect(result[1].transfers).toEqual([
      { from: 'b', to: 'a', amount: 3.33 },
      { from: 'c', to: 'a', amount: 3.33 },
    ]);
  });

  it('나간 멤버가 지난 경비에 남아 있어도 그대로 계산에 들어간다', () => {
    const [krw] = settleExpenses([{ payerId: 'left', amount: 2000, currency: 'KRW', splitAmong: ['left', 'a'] }]);
    expect(krw.transfers).toEqual([{ from: 'a', to: 'left', amount: 1000 }]);
  });

  it('본인만 나눈 경비는 송금이 없다', () => {
    expect(settleExpenses([{ payerId: 'a', amount: 5000, currency: 'KRW', splitAmong: ['a'] }])[0].transfers).toEqual([]);
  });
});
