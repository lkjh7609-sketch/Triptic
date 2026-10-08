import { describe, expect, it, vi } from 'vitest';
import { localDate, mapLimit, pickLocalDay, refreshDestinations, toRow } from './refresh.js';

describe('localDate / pickLocalDay — 도시의 현지 날짜', () => {
  it('같은 순간도 시간대에 따라 날짜가 다르다', () => {
    const now = new Date('2026-10-08T16:00:00Z'); // 서울은 10/9 01:00, 뉴욕은 10/8 12:00
    expect(localDate('Asia/Seoul', now)).toBe('2026-10-09');
    expect(localDate('America/New_York', now)).toBe('2026-10-08');
  });

  it('현지 자정에 시작하는 날(UTC로는 전날 15:00)을 그 도시의 오늘로 고른다', () => {
    const days = [
      { forecastStart: '2026-10-07T15:00:00Z', temperatureMax: 20 }, // 서울 10/8
      { forecastStart: '2026-10-08T15:00:00Z', temperatureMax: 22 }, // 서울 10/9
    ];
    expect(pickLocalDay(days, 'Asia/Seoul', '2026-10-09')?.temperatureMax).toBe(22);
    expect(pickLocalDay(days, 'Asia/Seoul', '2026-10-08')?.temperatureMax).toBe(20);
    expect(pickLocalDay(days, 'Asia/Seoul', '2026-10-20')).toBeNull();
    expect(pickLocalDay(undefined, 'Asia/Seoul', '2026-10-09')).toBeNull();
  });
});

describe('toRow', () => {
  const now = new Date('2026-10-08T00:00:00Z');
  it('저장할 행을 만든다(소수 1자리, 강수 확률 0~1)', () => {
    expect(toRow('d1', { temperatureMax: 24.96, temperatureMin: 16.04, conditionCode: 'Clear', precipitationChance: 0.371 }, '2026-10-08', now)).toEqual({
      destination_id: 'd1', date: '2026-10-08', tmax_c: 25, tmin_c: 16, condition_code: 'Clear', precip_chance: 0.37, updated_at: now.toISOString(),
    });
  });
  it('최고·최저가 모두 없으면 null', () => {
    expect(toRow('d1', { conditionCode: 'Clear' }, '2026-10-08', now)).toBeNull();
  });
  it('강수 확률이 없거나 범위 밖이어도 안전', () => {
    expect(toRow('d1', { temperatureMax: 1, precipitationChance: 7 }, '2026-10-08', now)?.precip_chance).toBe(1);
    expect(toRow('d1', { temperatureMax: 1 }, '2026-10-08', now)?.precip_chance).toBeNull();
  });
});

describe('mapLimit', () => {
  it('동시에 limit개까지만 돌리고 결과 순서를 지킨다', async () => {
    let running = 0;
    let peak = 0;
    const out = await mapLimit([1, 2, 3, 4, 5, 6], 2, async (n) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      return n * 10;
    });
    expect(out).toEqual([10, 20, 30, 40, 50, 60]);
    expect(peak).toBe(2);
  });
});

describe('refreshDestinations', () => {
  const now = new Date('2026-10-08T00:00:00Z'); // 서울 10/8 09:00
  const dests = [
    { id: 'a', slug: 'seoul', lat: 37.5, lng: 127, timezone: 'Asia/Seoul' },
    { id: 'b', slug: 'sydney', lat: -33.8, lng: 151.2, timezone: 'Australia/Sydney' },
    { id: 'c', slug: 'broken', lat: 0, lng: 0, timezone: 'UTC' },
  ];

  it('도시마다 현지 오늘 날씨를 모으고, 실패한 도시는 건너뛰고 알린다', async () => {
    const fetchDays = vi.fn(async (d) => {
      if (d.slug === 'broken') throw new Error('WeatherKit 500');
      // 서울 10/8 = UTC 10/7 15:00, 시드니 10/8 = UTC 10/7 13:00(+11)
      const start = d.slug === 'seoul' ? '2026-10-07T15:00:00Z' : '2026-10-07T13:00:00Z';
      return [{ forecastStart: start, temperatureMax: 21, temperatureMin: 12, conditionCode: 'Cloudy', precipitationChance: 0.1 }];
    });
    const out = await refreshDestinations({ destinations: dests, fetchDays, now });
    expect(out.rows.map((r) => r.destination_id).sort()).toEqual(['a', 'b']);
    expect(out.rows.every((r) => r.date === '2026-10-08')).toBe(true);
    expect(out.failed).toEqual(['broken']);
  });

  it('현지 오늘 날이 응답에 없으면 그 도시는 실패로 센다', async () => {
    const out = await refreshDestinations({ destinations: [dests[0]], fetchDays: async () => [{ forecastStart: '2026-10-01T15:00:00Z', temperatureMax: 1 }], now });
    expect(out.rows).toEqual([]);
    expect(out.failed).toEqual(['seoul']);
  });
});
