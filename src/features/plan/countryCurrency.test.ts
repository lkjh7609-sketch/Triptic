import { describe, expect, it } from 'vitest';
import { currencyForCountry } from './countryCurrency';

describe('currencyForCountry', () => {
  it('나라의 통화를 돌려준다', () => {
    expect(currencyForCountry('JP')).toBe('JPY');
    expect(currencyForCountry('vn')).toBe('VND');
    expect(currencyForCountry('US')).toBe('USD');
  });

  it('유로 사용국은 EUR', () => {
    for (const c of ['FR', 'DE', 'IT', 'ES', 'GR']) expect(currencyForCountry(c)).toBe('EUR');
  });

  it('지원하지 않는 나라·값 없음은 KRW', () => {
    expect(currencyForCountry('TR')).toBe('KRW');
    expect(currencyForCountry('')).toBe('KRW');
    expect(currencyForCountry(null)).toBe('KRW');
    expect(currencyForCountry(undefined)).toBe('KRW');
  });
});
