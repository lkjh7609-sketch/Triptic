import { describe, expect, it } from 'vitest';
import type { TripRow } from '@/shared/api/tripService';
import { buildTripReminders, daysBetween, stageFor } from './tripReminders';

function trip(id: string, start: string | null, over: Partial<TripRow> = {}): TripRow {
  return {
    id,
    owner_id: 'u',
    title: `여행 ${id}`,
    city: '도쿄',
    start_date: start,
    end_date: start,
    status: 'planning',
    ...over,
  } as TripRow;
}

describe('stageFor', () => {
  it('당일·하루 전·2~7일 전만 단계가 있다', () => {
    expect(stageFor(0)).toBe('today');
    expect(stageFor(1)).toBe('dayBefore');
    expect(stageFor(2)).toBe('week');
    expect(stageFor(7)).toBe('week');
    expect(stageFor(8)).toBeNull();
    expect(stageFor(-1)).toBeNull();
  });
});

describe('daysBetween', () => {
  it('달·해가 바뀌어도 날짜 차이를 센다', () => {
    expect(daysBetween('2026-12-30', '2027-01-02')).toBe(3);
    expect(daysBetween('2026-10-03', '2026-10-03')).toBe(0);
  });
});

describe('buildTripReminders', () => {
  const today = '2026-10-03';
  it('7일 이내 출발하는 여행만, 가까운 순으로 만든다', () => {
    const list = buildTripReminders(
      [
        trip('far', '2026-10-20'),
        trip('week', '2026-10-09'),
        trip('today', '2026-10-03'),
        trip('tomorrow', '2026-10-04'),
        trip('past', '2026-10-01'),
      ],
      today,
    );
    expect(list.map((r) => [r.tripId, r.stage])).toEqual([
      ['today', 'today'],
      ['tomorrow', 'dayBefore'],
      ['week', 'week'],
    ]);
    expect(list[2].daysUntil).toBe(6);
    expect(list[0].id).toBe('today:today');
  });

  it('날짜가 없거나 보관한 여행은 뺀다', () => {
    expect(
      buildTripReminders([trip('a', null), trip('b', '2026-10-04', { status: 'archived' })], today),
    ).toEqual([]);
  });
});
