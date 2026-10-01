import { describe, expect, it } from 'vitest';
import { formatTripPeriod } from './tripPeriodText';

describe('formatTripPeriod', () => {
  it('시작 - 끝 (n일)', () => {
    expect(formatTripPeriod({ start_date: '2024-10-12', end_date: '2024-10-15' }, '4일')).toBe('2024.10.12 - 10.15 (4일)');
  });
  it('당일치기는 끝 날짜를 생략', () => {
    expect(formatTripPeriod({ start_date: '2024-10-12', end_date: '2024-10-12' }, '1일')).toBe('2024.10.12 (1일)');
  });
  it('날짜가 없으면 일 수만', () => {
    expect(formatTripPeriod({ start_date: null, end_date: null }, '3일')).toBe('3일');
  });
});
