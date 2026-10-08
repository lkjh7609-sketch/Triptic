import { afterEach, describe, expect, it, vi } from 'vitest';

const select = vi.fn();
vi.mock('@/shared/api/supabaseClient', () => ({
  getSupabaseClient: () => ({ from: () => ({ select: () => ({ in: select }) }) }),
}));

import { MAX_WEATHER_AGE_MS, fetchDestinationWeathers, isFreshWeather, toDestinationWeather } from './destinationWeather';

afterEach(() => select.mockReset());

const row = (over: Record<string, unknown> = {}) => ({
  destination_id: 'd1',
  date: '2026-10-08',
  tmax_c: '24.5',
  tmin_c: 16,
  condition_code: 'Clear',
  precip_chance: '0.20',
  updated_at: new Date().toISOString(),
  ...over,
});

describe('destination_weather 읽기', () => {
  it('문자열 숫자를 숫자로 바꾼다', () => {
    expect(toDestinationWeather(row() as never)).toMatchObject({ destinationId: 'd1', tmaxC: 24.5, tminC: 16, precipChance: 0.2, conditionCode: 'Clear' });
  });

  it('신선한 값만 쓴다(36시간 이내)', () => {
    const now = Date.parse('2026-10-08T12:00:00Z');
    expect(isFreshWeather({ updatedAt: new Date(now - MAX_WEATHER_AGE_MS + 1000).toISOString() }, now)).toBe(true);
    expect(isFreshWeather({ updatedAt: new Date(now - MAX_WEATHER_AGE_MS - 1000).toISOString() }, now)).toBe(false);
    expect(isFreshWeather({ updatedAt: 'bad' }, now)).toBe(false);
  });

  it('여러 도시를 한 번에 읽고 오래된 값·기온 없는 값은 뺀다', async () => {
    select.mockResolvedValue({
      data: [
        row(),
        row({ destination_id: 'd2', updated_at: '2026-01-01T00:00:00Z' }),
        row({ destination_id: 'd3', tmax_c: null, tmin_c: null }),
        row({ destination_id: 'd4', tmax_c: null, tmin_c: 3 }),
      ],
      error: null,
    });
    const out = await fetchDestinationWeathers(['d1', 'd2', 'd3', 'd4']);
    expect(Object.keys(out).sort()).toEqual(['d1', 'd4']);
  });

  it('도시가 없으면 묻지 않는다', async () => {
    expect(await fetchDestinationWeathers([])).toEqual({});
    expect(select).not.toHaveBeenCalled();
  });

  it('조회가 실패하면 던진다(화면은 날씨 칸만 뺀다)', async () => {
    select.mockResolvedValue({ data: null, error: new Error('boom') });
    await expect(fetchDestinationWeathers(['d1'])).rejects.toThrow('boom');
  });
});
