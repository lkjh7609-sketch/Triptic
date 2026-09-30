import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SEASON_CITIES } from './seasonData';
import { useSeasonTemps } from './useSeasonTemps';

const picks = [
  { id: 'kyoto', city: SEASON_CITIES.kyoto },
  { id: 'paris', city: SEASON_CITIES.paris },
];

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('useSeasonTemps — 못 받아도 이전 값을 보여준다', () => {
  it('처음부터 받지 못해도 마지막으로 잘 받은 값이 남아 있다', async () => {
    localStorage.setItem('triptic-season-weather-v1', JSON.stringify({ kyoto: { temp: 12, code: 3 }, paris: { temp: 8, code: 61 } }));
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useSeasonTemps(picks, { retry: false }), { wrapper: wrapperFor(client) });
    // 시작부터 이전 값이 보이고, 새로 받기에 실패해도 그대로다
    expect(result.current.data).toEqual({ kyoto: { temp: 12, code: 3 }, paris: { temp: 8, code: 61 } });
    await waitFor(() => expect(result.current.isFetching).toBe(false));
    expect(result.current.data).toEqual({ kyoto: { temp: 12, code: 3 }, paris: { temp: 8, code: 61 } });
  });

  it('한 번 받은 뒤 다시 받는 데 실패해도 값이 지워지지 않는다', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [{ current: { temperature_2m: 20, weather_code: 0 } }, { current: { temperature_2m: 15, weather_code: 2 } }] })
      .mockRejectedValue(new Error('down'));
    vi.stubGlobal('fetch', fetchMock);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useSeasonTemps(picks, { retry: false }), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(result.current.data?.kyoto?.temp).toBe(20));
    await client.invalidateQueries({ queryKey: ['seasonTemps'] });
    await waitFor(() => expect(result.current.isFetching).toBe(false));
    expect(result.current.data).toEqual({ kyoto: { temp: 20, code: 0 }, paris: { temp: 15, code: 2 } });
    // 잘 받은 값은 기기에도 남는다
    expect(JSON.parse(localStorage.getItem('triptic-season-weather-v1') ?? '{}').kyoto.temp).toBe(20);
  });

  it('일부 도시만 받아져도 나머지는 이전 값을 유지한다', async () => {
    localStorage.setItem('triptic-season-weather-v1', JSON.stringify({ kyoto: { temp: 12, code: 3 }, paris: { temp: 8, code: 61 } }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [{ current: { temperature_2m: 21, weather_code: 0 } }, { current: {} }] }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useSeasonTemps(picks, { retry: false }), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(result.current.data?.kyoto?.temp).toBe(21));
    expect(result.current.data?.paris).toEqual({ temp: 8, code: 61 });
  });
});
