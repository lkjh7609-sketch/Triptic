import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchSeasonTemps } from './useSeasonTemps';

afterEach(() => vi.restoreAllMocks());

const cities = [
  { id: 'kyoto', lat: 35, lng: 135 },
  { id: 'paris', lat: 48, lng: 2 },
];

describe('fetchSeasonTemps', () => {
  it('좌표를 쉼표로 이어 한 번에 요청하고 같은 순서로 기온을 맞춘다', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ current: { temperature_2m: 18.4, weather_code: 3 } }, { current: { temperature_2m: 16 } }],
    });
    vi.stubGlobal('fetch', fetchMock);
    const temps = await fetchSeasonTemps(cities);
    expect(temps).toEqual({ kyoto: { temp: 18.4, code: 3 }, paris: { temp: 16, code: null } });
    expect(String(fetchMock.mock.calls[0][0])).toContain('weather_code');
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('latitude=35%2C48');
    expect(url).toContain('longitude=135%2C2');
  });

  it('응답이 실패하면 빈 객체(기온만 빠진다)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    expect(await fetchSeasonTemps(cities)).toEqual({});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await fetchSeasonTemps(cities)).toEqual({});
  });

  it('숫자가 아닌 값은 건너뛴다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [{ current: { temperature_2m: null } }, { current: { temperature_2m: 10 } }] }));
    expect(await fetchSeasonTemps(cities)).toEqual({ paris: { temp: 10, code: null } });
  });
});
