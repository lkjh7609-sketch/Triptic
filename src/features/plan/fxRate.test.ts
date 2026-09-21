import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchDailyRate } from './fxRate';

describe('fetchDailyRate', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('같은 통화면 네트워크 호출 없이 1을 반환한다', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchDailyRate('KRW', 'KRW')).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('API 응답에서 환율을 읽어 반환한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ rates: { KRW: 9.5 } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchDailyRate('JPY', 'KRW')).toBe(9.5);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('base=JPY&symbols=KRW'));
  });

  it('같은 날 같은 통화쌍은 캐시에서 반환해 재조회하지 않는다', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ rates: { KRW: 9.5 } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await fetchDailyRate('JPY', 'KRW');
    await fetchDailyRate('JPY', 'KRW');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('응답이 실패하면 null을 반환한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    expect(await fetchDailyRate('JPY', 'KRW')).toBeNull();
  });

  it('네트워크 에러가 나면 null을 반환한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network down')),
    );
    expect(await fetchDailyRate('JPY', 'KRW')).toBeNull();
  });

  it('응답에 해당 통화 환율이 없으면 null을 반환한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ rates: {} }) }),
    );
    expect(await fetchDailyRate('JPY', 'KRW')).toBeNull();
  });
});
