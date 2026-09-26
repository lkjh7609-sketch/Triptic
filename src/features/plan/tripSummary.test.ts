import { describe, expect, it } from 'vitest';
import type { TripRow } from '@/shared/api/tripService';
import { summarizeTrip } from './tripSummary';

function trip(content: Partial<TripRow['content']>, totalDays = 3): TripRow {
  return {
    id: 't1',
    owner_id: 'u1',
    title: 'Trip',
    city: 'Tokyo',
    city_lat: null,
    city_lng: null,
    start_date: '2026-10-01',
    end_date: '2026-10-03',
    total_days: totalDays,
    base_currency: 'KRW',
    status: 'planning',
    content: { data: {}, hotels: {}, meals: {}, expenses: {}, flights: { outbound: null, return: null }, dayCities: {}, ...content },
    created_at: '',
    updated_at: '',
  } as TripRow;
}

const place = { name: 'A', lat: 1, lng: 1 };

describe('summarizeTrip', () => {
  it('빈 여행은 완성도 0%, 숙소·항공 없음', () => {
    expect(summarizeTrip(trip({}))).toMatchObject({ totalDays: 3, plannedDays: 0, placeCount: 0, completeness: 0, hasHotel: false, hasFlight: false });
  });

  it('장소가 있는 날 비율로 완성도를 계산한다', () => {
    const s = summarizeTrip(trip({ data: { 1: [place, place], 3: [place] } }));
    expect(s).toMatchObject({ plannedDays: 2, placeCount: 3, completeness: 67 });
  });

  it('숙소 이름과 항공편이 있으면 표시한다', () => {
    const s = summarizeTrip(
      trip({
        hotels: { 1: { name: 'Hotel', lat: 1, lng: 1 } },
        flights: { outbound: { flightNo: 'OZ1', dep: { name: 'GMP' }, arr: { name: 'HND' } } as never, return: null },
      }),
    );
    expect(s.hasHotel).toBe(true);
    expect(s.hasFlight).toBe(true);
    expect(s.outbound?.flightNo).toBe('OZ1');
  });
});
