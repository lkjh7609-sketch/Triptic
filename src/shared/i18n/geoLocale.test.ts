import { describe, expect, it } from 'vitest';
import { localeForCountry } from './geoLocale';

describe('localeForCountry', () => {
  it('한국 IP는 한국어', () => {
    expect(localeForCountry('KR')).toBe('ko');
    expect(localeForCountry('kr')).toBe('ko');
  });

  it('일본은 일본어, 대만·홍콩·마카오는 번체 중국어', () => {
    expect(localeForCountry('JP')).toBe('ja');
    expect(localeForCountry('TW')).toBe('zh-TW');
    expect(localeForCountry('hk')).toBe('zh-TW');
    expect(localeForCountry('MO')).toBe('zh-TW');
  });

  it('그 밖의 나라는 영어', () => {
    expect(localeForCountry('US')).toBe('en');
    expect(localeForCountry('CN')).toBe('en');
    expect(localeForCountry('AU')).toBe('en');
  });

  it('국가를 모르면 null(브라우저 언어 유지)', () => {
    expect(localeForCountry(null)).toBeNull();
    expect(localeForCountry(undefined)).toBeNull();
    expect(localeForCountry('')).toBeNull();
  });
});
