import { describe, expect, it } from 'vitest';
import { getRate, type FxRates } from './fxRates';

const rates: FxRates = { perUsd: { USD: 1, KRW: 1350, JPY: 150 }, newestAt: '2026-09-26T01:05:00Z' };

describe('getRate', () => {
  it('같은 통화면 1', () => {
    expect(getRate(rates, 'KRW', 'KRW')).toBe(1);
  });

  it('USD 기준 교차 환율로 계산한다 (1 JPY = 9 KRW)', () => {
    expect(getRate(rates, 'JPY', 'KRW')).toBeCloseTo(9, 6);
    expect(getRate(rates, 'KRW', 'USD')).toBeCloseTo(1 / 1350, 9);
  });

  it('어느 한쪽 환율이 없으면 null', () => {
    expect(getRate(rates, 'VND', 'KRW')).toBeNull();
    expect(getRate(undefined, 'JPY', 'KRW')).toBeNull();
  });
});
