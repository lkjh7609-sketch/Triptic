import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchSeasonTemps, mergeWeather, readLastGood } from './useSeasonTemps';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

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

  it('응답이 실패하면 빈 값이 아니라 오류를 던진다(호출한 쪽이 이전 값을 지키게)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(fetchSeasonTemps(cities)).rejects.toThrow('503');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(fetchSeasonTemps(cities)).rejects.toThrow('offline');
  });

  it('숫자가 아닌 값은 건너뛴다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [{ current: { temperature_2m: null } }, { current: { temperature_2m: 10 } }] }));
    expect(await fetchSeasonTemps(cities)).toEqual({ paris: { temp: 10, code: null } });
  });
});

describe('마지막으로 잘 받은 값', () => {
  it('새 값이 없는 도시는 이전 값을 그대로 두고, 새 값이 있는 도시만 덮는다', () => {
    const merged = mergeWeather({ kyoto: { temp: 10, code: 1 }, paris: { temp: 5, code: 3 } }, { paris: { temp: 7, code: 0 } });
    expect(merged).toEqual({ kyoto: { temp: 10, code: 1 }, paris: { temp: 7, code: 0 } });
  });

  it('저장된 값이 없거나 깨져 있으면 빈 객체', () => {
    expect(readLastGood()).toEqual({});
    localStorage.setItem('triptic-season-weather-v1', '{not json');
    expect(readLastGood()).toEqual({});
    localStorage.setItem('triptic-season-weather-v1', JSON.stringify({ kyoto: { temp: 'x' }, paris: { temp: 7, code: 2 } }));
    expect(readLastGood()).toEqual({ paris: { temp: 7, code: 2 } });
  });
});
