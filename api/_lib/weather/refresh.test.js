import { describe, expect, it, vi } from 'vitest';
import { localDate, mapLimit, pickLocalDay, refreshDestinations, toRow } from './refresh.js';

describe('localDate — 도시의 현지 날짜(저장하는 date 값)', () => {
  it('같은 순간도 시간대에 따라 날짜가 다르다', () => {
    const now = new Date('2026-10-08T16:00:00Z'); // 서울은 10/9 01:00, 뉴욕은 10/8 12:00
    expect(localDate('Asia/Seoul', now)).toBe('2026-10-09');
    expect(localDate('America/New_York', now)).toBe('2026-10-08');
  });
});

describe('pickLocalDay — 지금이 속한 날(시간대 데이터에 기대지 않는다)', () => {
  const day = (start, end, tmax) => ({ forecastStart: start, forecastEnd: end, temperatureMax: tmax });

  it('시작·끝 시각 안에 지금이 있는 날을 고른다', () => {
    const days = [
      day('2026-10-07T15:00:00Z', '2026-10-08T15:00:00Z', 20), // 서울 10/8
      day('2026-10-08T15:00:00Z', '2026-10-09T15:00:00Z', 22), // 서울 10/9
    ];
    expect(pickLocalDay(days, new Date('2026-10-08T00:00:00Z'))?.temperatureMax).toBe(20);
    expect(pickLocalDay(days, new Date('2026-10-08T16:00:00Z'))?.temperatureMax).toBe(22);
  });

  it('하루가 UTC 23:00에 시작하는 도시(카사블랑카)도 맞는다', () => {
    const days = [day('2026-10-06T23:00:00Z', '2026-10-07T23:00:00Z', 24), day('2026-10-07T23:00:00Z', '2026-10-08T23:00:00Z', 26)];
    expect(pickLocalDay(days, new Date('2026-10-08T05:00:00Z'))?.temperatureMax).toBe(26);
  });

  it('끝 시각이 없으면 24시간으로 보고, 지금이 어느 날에도 안 속하면 null', () => {
    expect(pickLocalDay([{ forecastStart: '2026-10-08T00:00:00Z', temperatureMax: 5 }], new Date('2026-10-08T12:00:00Z'))?.temperatureMax).toBe(5);
    expect(pickLocalDay([day('2026-10-01T00:00:00Z', '2026-10-02T00:00:00Z', 1)], new Date('2026-10-08T12:00:00Z'))).toBeNull();
    expect(pickLocalDay(undefined)).toBeNull();
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
      // 서울 10/8 = UTC 10/7 15:00부터, 시드니 10/8 = UTC 10/7 13:00부터(+11)
      const start = d.slug === 'seoul' ? '2026-10-07T15:00:00Z' : '2026-10-07T13:00:00Z';
      const end = d.slug === 'seoul' ? '2026-10-08T15:00:00Z' : '2026-10-08T13:00:00Z';
      return [{ forecastStart: start, forecastEnd: end, temperatureMax: 21, temperatureMin: 12, conditionCode: 'Cloudy', precipitationChance: 0.1 }];
    });
    const out = await refreshDestinations({ destinations: dests, fetchDays, now });
    expect(out.rows.map((r) => r.destination_id).sort()).toEqual(['a', 'b']);
    expect(out.rows.every((r) => r.date === '2026-10-08')).toBe(true);
    expect(out.failed).toEqual(['broken']);
  });

  it('현지 오늘 날이 응답에 없으면 그 도시는 실패로 센다', async () => {
    const out = await refreshDestinations({ destinations: [dests[0]], fetchDays: async () => [{ forecastStart: '2026-10-01T15:00:00Z', forecastEnd: '2026-10-02T15:00:00Z', temperatureMax: 1 }], now });
    expect(out.rows).toEqual([]);
    expect(out.failed).toEqual(['seoul']);
  });
});
