import { describe, expect, it } from 'vitest';
import { localeForCountry } from './geoLocale';

describe('localeForCountry', () => {
  it('한국 IP는 한국어', () => {
    expect(localeForCountry('KR')).toBe('ko');
    expect(localeForCountry('kr')).toBe('ko');
  });

  it('그 밖의 나라는 영어', () => {
    expect(localeForCountry('US')).toBe('en');
    expect(localeForCountry('JP')).toBe('en');
    expect(localeForCountry('TW')).toBe('en');
  });

  it('국가를 모르면 null(브라우저 언어 유지)', () => {
    expect(localeForCountry(null)).toBeNull();
    expect(localeForCountry(undefined)).toBeNull();
    expect(localeForCountry('')).toBeNull();
  });
});
