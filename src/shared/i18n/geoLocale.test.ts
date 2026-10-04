import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectLocaleByIp, localeForCountry } from './geoLocale';

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

describe('detectLocaleByIp', () => {
  afterEach(() => {
    delete window.__prefetch;
    vi.unstubAllGlobals();
  });

  it('index.html이 미리 요청해 둔 결과가 있으면 새로 요청하지 않고 그 나라로 정한다', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    window.__prefetch = { '/api/geo': Promise.resolve({ country: 'KR' }) };
    expect(await detectLocaleByIp()).toBe('ko');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('미리 요청한 게 없거나 실패했으면 평소처럼 요청한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ country: 'JP' }) });
    vi.stubGlobal('fetch', fetchMock);
    expect(await detectLocaleByIp()).toBe('ja');
    window.__prefetch = { '/api/geo': Promise.reject(new Error('net')) };
    expect(await detectLocaleByIp()).toBe('ja');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('오래 걸리면 null — 시간 제한 안에 끝난다', async () => {
    vi.stubGlobal('fetch', vi.fn());
    window.__prefetch = { '/api/geo': new Promise(() => {}) };
    expect(await detectLocaleByIp(20)).toBeNull();
  });
});
