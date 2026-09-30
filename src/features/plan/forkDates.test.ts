import { describe, expect, it } from 'vitest';
import { diffDays, forkDates, shiftYmd } from './forkDates';

describe('forkDates', () => {
  it('새 출발일을 고르면 일 수는 그대로 그 날부터 이어진다', () => {
    expect(forkDates('2026-10-15', 4, '2026-12-30')).toEqual({ startDate: '2026-12-30', endDate: '2027-01-02', offsetDays: 76 });
  });

  it('고르지 않으면 원본 날짜 그대로', () => {
    expect(forkDates('2026-10-15', 4)).toEqual({ startDate: '2026-10-15', endDate: '2026-10-18', offsetDays: 0 });
  });

  it('일 수가 0이어도 하루는 유지', () => {
    expect(forkDates('2026-10-15', 0, '2026-10-20').endDate).toBe('2026-10-20');
  });

  it('윤년·월 넘김', () => {
    expect(shiftYmd('2028-02-28', 2)).toBe('2028-03-01');
    expect(shiftYmd('2026-03-01', -1)).toBe('2026-02-28');
    expect(diffDays('2026-10-01', '2026-09-30')).toBe(-1);
  });
});
