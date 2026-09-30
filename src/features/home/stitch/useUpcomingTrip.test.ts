import { describe, expect, it } from 'vitest';
import type { TripRow } from '@/shared/api/tripService';
import { pickUpcomingTrip } from './useUpcomingTrip';

function trip(over: Partial<TripRow>): TripRow {
  return {
    id: 'x',
    owner_id: 'u',
    title: 't',
    city: null,
    city_lat: null,
    city_lng: null,
    start_date: '2026-10-10',
    end_date: '2026-10-12',
    total_days: 3,
    base_currency: null,
    status: 'planning',
    created_at: '',
    updated_at: '',
    ...over,
  };
}

describe('pickUpcomingTrip', () => {
  const today = '2026-10-01';

  it('출발이 가장 빠른 예정 여행을 고른다', () => {
    const picked = pickUpcomingTrip([trip({ id: 'late', start_date: '2026-12-01', end_date: '2026-12-03' }), trip({ id: 'soon' })], today);
    expect(picked?.id).toBe('soon');
  });

  it('이미 끝난 여행·보관된 여행·날짜 없는 여행은 뺀다', () => {
    const picked = pickUpcomingTrip(
      [
        trip({ id: 'past', start_date: '2026-09-01', end_date: '2026-09-03' }),
        trip({ id: 'archived', status: 'archived' }),
        trip({ id: 'nodate', start_date: null, end_date: null }),
      ],
      today,
    );
    expect(picked).toBeUndefined();
  });

  it('진행 중인 여행도 포함한다', () => {
    const picked = pickUpcomingTrip([trip({ id: 'now', start_date: '2026-09-30', end_date: '2026-10-02' })], today);
    expect(picked?.id).toBe('now');
  });
});
