import { describe, expect, it } from 'vitest';
import type { FlightDeal } from '../flightDealsData';
import { monthRange, pickHomeDeals, splitPostBody } from './homeUtils';

function deal(code: string, price: number, discountPct: number | null): FlightDeal {
  return { code, city: code, airport: '', theme: 'japan', price, currency: 'KRW', departDate: '2026-11-01', returnDate: '2026-11-05', airline: null, airlineName: null, average: null, discountPct };
}

describe('pickHomeDeals', () => {
  it('할인율이 큰 순, 같으면 싼 순으로 4개', () => {
    const picked = pickHomeDeals([deal('A', 300, null), deal('B', 200, 10), deal('C', 250, 40), deal('D', 100, 10), deal('E', 90, null), deal('F', 400, 5)]);
    expect(picked.map((d) => d.code)).toEqual(['C', 'D', 'B', 'F']);
  });
});

describe('splitPostBody', () => {
  it('첫 줄은 제목, 나머지는 한 줄 요약', () => {
    expect(splitPostBody('교토 다녀왔어요\n\n사찰이 좋았어요\n차도 마셨어요')).toEqual({ title: '교토 다녀왔어요', summary: '사찰이 좋았어요 차도 마셨어요' });
  });

  it('한 줄뿐이면 요약은 비어 있다', () => {
    expect(splitPostBody('한 줄 후기')).toEqual({ title: '한 줄 후기', summary: '' });
  });
});

describe('monthRange', () => {
  it('이달과 다음 달(12월 다음은 1월)', () => {
    expect(monthRange(10, 'ko')).toBe('10월~11월');
    expect(monthRange(12, 'ko')).toBe('12월~1월');
  });
});
