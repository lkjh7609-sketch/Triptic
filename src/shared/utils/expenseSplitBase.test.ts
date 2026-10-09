import { describe, expect, it } from 'vitest';
import { settleInBase, shareInBase } from './expenseSplit';

describe('shareInBase', () => {
  it('둘이 만 원을 나누면 한 사람 5,000원', () => {
    const e = { payerId: 'a', amount: 10000, currency: 'KRW', splitAmong: ['a', 'b'] };
    expect(shareInBase(e, 'a', 'KRW')).toBe(5000);
    expect(shareInBase(e, 'b', 'KRW')).toBe(5000);
  });

  it('나눌 사람에 없으면 0', () => {
    expect(shareInBase({ payerId: 'a', amount: 10000, currency: 'KRW', splitAmong: ['a', 'b'] }, 'c', 'KRW')).toBe(0);
  });

  it('나머지는 id 순서 앞사람이 1원 더 — 몫의 합이 총액과 같다', () => {
    const e = { payerId: 'a', amount: 10000, currency: 'KRW', splitAmong: ['c', 'a', 'b'] };
    const shares = ['a', 'b', 'c'].map((id) => shareInBase(e, id, 'KRW'));
    expect(shares).toEqual([3334, 3333, 3333]);
    expect(shares.reduce((x, y) => x + y, 0)).toBe(10000);
  });

  it('다른 통화는 적은 당시 환율로 환산한다', () => {
    const e = { payerId: 'a', amount: 100, currency: 'USD', fxRateToBase: 1400, splitAmong: ['a', 'b'] };
    expect(shareInBase(e, 'a', 'KRW')).toBe(70000);
  });

  it('환율이 없으면 0(합계에서 뺀다)', () => {
    expect(shareInBase({ payerId: 'a', amount: 100, currency: 'USD', splitAmong: ['a', 'b'] }, 'a', 'KRW')).toBe(0);
  });
});

describe('settleInBase', () => {
  const base = { currency: 'KRW', splitAmong: ['a', 'b', 'c'] };

  it('통화가 섞여도 기본 통화로 환산해 한 번에 정산한다', () => {
    const r = settleInBase(
      [
        { ...base, payerId: 'a', amount: 30000 }, // 각 10000
        { payerId: 'b', amount: 30, currency: 'USD', fxRateToBase: 1500, splitAmong: ['a', 'b', 'c'] }, // 45000 → 각 15000
      ],
      [],
      'KRW',
    );
    // a: +30000-10000-15000 = +5000, b: +45000-25000 = +20000, c: -25000
    expect(r.total).toBe(75000);
    expect(r.transfers).toEqual([
      { from: 'c', to: 'b', amount: 20000 },
      { from: 'c', to: 'a', amount: 5000 },
    ]);
    expect(r.balances).toEqual({ a: 5000, b: 20000, c: -25000 });
    expect(r.unconverted).toBe(0);
  });

  it('일부만 나눈 경비(2명)도 계산한다', () => {
    const r = settleInBase([{ payerId: 'a', amount: 10000, currency: 'KRW', splitAmong: ['a', 'b'] }], [], 'KRW');
    expect(r.transfers).toEqual([{ from: 'b', to: 'a', amount: 5000 }]);
  });

  it('송금 완료는 잔액에 반영돼 줄이 줄어든다', () => {
    const expenses = [{ ...base, payerId: 'a', amount: 30000 }];
    const part = settleInBase(expenses, [{ from: 'b', to: 'a', amount: 4000 }], 'KRW');
    expect(part.transfers).toEqual([
      { from: 'c', to: 'a', amount: 10000 },
      { from: 'b', to: 'a', amount: 6000 },
    ]);
    const done = settleInBase(
      expenses,
      [
        { from: 'b', to: 'a', amount: 10000 },
        { from: 'c', to: 'a', amount: 10000 },
      ],
      'KRW',
    );
    expect(done.transfers).toEqual([]);
    expect(Object.values(done.balances).every((v) => v === 0)).toBe(true);
  });

  it('환율이 없는 외화는 합계에서 빼고 건수만 센다', () => {
    const r = settleInBase(
      [
        { ...base, payerId: 'a', amount: 30000 },
        { payerId: 'b', amount: 50, currency: 'USD', splitAmong: ['a', 'b'] },
      ],
      [],
      'KRW',
    );
    expect(r.unconverted).toBe(1);
    expect(r.total).toBe(30000);
  });

  it('낸 사람이 나눌 사람에 없어도(대신 계산) 정산된다', () => {
    const r = settleInBase([{ payerId: 'a', amount: 20000, currency: 'KRW', splitAmong: ['b', 'c'] }], [], 'KRW');
    expect(r.transfers).toEqual([
      { from: 'b', to: 'a', amount: 10000 },
      { from: 'c', to: 'a', amount: 10000 },
    ]);
  });

  it('나간 일행의 경비도 그대로 계산에 들어간다', () => {
    const r = settleInBase([{ payerId: 'left', amount: 2000, currency: 'KRW', splitAmong: ['left', 'a'] }], [], 'KRW');
    expect(r.transfers).toEqual([{ from: 'a', to: 'left', amount: 1000 }]);
  });

  it('엔은 1엔 단위, 달러 기본 통화는 센트 단위로 합이 맞는다', () => {
    const jpy = settleInBase([{ payerId: 'a', amount: 1000, currency: 'JPY', splitAmong: ['a', 'b', 'c'] }], [], 'JPY');
    expect(jpy.transfers.reduce((s, t) => s + t.amount, 0)).toBe(666);
    const usd = settleInBase([{ payerId: 'a', amount: 10, currency: 'USD', splitAmong: ['a', 'b', 'c'] }], [], 'USD');
    expect(usd.transfers).toEqual([
      { from: 'b', to: 'a', amount: 3.33 },
      { from: 'c', to: 'a', amount: 3.33 },
    ]);
  });
});
