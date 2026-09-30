import { describe, expect, it } from 'vitest';
import { cheapestByTheme, formatMonthDay, formatWon, upcomingDeals, type FlightDeal } from './flightDealsData';

const deal = (over: Partial<FlightDeal>): FlightDeal => ({
  code: 'KIX',
  city: '오사카',
  airport: '간사이 국제공항',
  theme: 'japan',
  price: 214800,
  currency: 'KRW',
  departDate: '2026-11-10',
  returnDate: '2026-11-14',
  airline: '7C',
  airlineName: '제주항공',
  average: null,
  discountPct: null,
  ...over,
});

describe('flightDealsData', () => {
  it('월.일 표기와 원 단위 숫자', () => {
    expect(formatMonthDay('2026-10-05')).toBe('10.05');
    expect(formatMonthDay('2026-01-22')).toBe('1.22');
    expect(formatWon(214800.4, 'ko')).toBe('214,800');
  });

  it('테마마다 가장 싼 도시 하나 — 특가가 없는 테마는 빠진다', () => {
    const best = cheapestByTheme([
      deal({ code: 'KIX', price: 214800 }),
      deal({ code: 'FUK', city: '후쿠오카', price: 168000 }),
      deal({ code: 'DAD', city: '다낭', theme: 'sea', price: 298500 }),
    ]);
    expect(best.japan?.code).toBe('FUK');
    expect(best.sea?.code).toBe('DAD');
    expect(best.far).toBeUndefined();
  });

  it('오늘·이미 지난 출발일은 뺀다(저장된 최저가라 며칠 묵은 날짜가 올 수 있다)', () => {
    const deals = [deal({ code: 'A', departDate: '2026-09-29' }), deal({ code: 'B', departDate: '2026-09-30' }), deal({ code: 'C', departDate: '2026-10-01' })];
    expect(upcomingDeals(deals, '2026-09-30').map((d) => d.code)).toEqual(['C']);
  });
});
