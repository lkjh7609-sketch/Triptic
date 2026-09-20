import { describe, it, expect, vi, afterEach } from 'vitest';
import { getTripPhase, getDDay } from './tripStatus';

describe('getTripPhase', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('오늘이 기간 내이면 ongoing', () => {
    vi.setSystemTime(new Date('2026-05-21T00:00:00'));
    expect(getTripPhase('2026-05-20', '2026-05-23')).toBe('ongoing');
  });

  it('시작일이 미래이면 upcoming', () => {
    vi.setSystemTime(new Date('2026-05-01T00:00:00'));
    expect(getTripPhase('2026-05-20', '2026-05-23')).toBe('upcoming');
  });

  it('종료일이 과거이면 past', () => {
    vi.setSystemTime(new Date('2026-06-01T00:00:00'));
    expect(getTripPhase('2026-05-20', '2026-05-23')).toBe('past');
  });

  it('날짜 정보가 없으면 upcoming으로 취급', () => {
    expect(getTripPhase(null, null)).toBe('upcoming');
  });

  it('유효하지 않은 날짜 문자열이면 크래시 없이 upcoming으로 취급', () => {
    expect(getTripPhase('110120-02-06', '110320-02-06')).toBe('upcoming');
  });
});

describe('getDDay', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('출발 5일 전이면 5를 반환한다', () => {
    vi.setSystemTime(new Date('2026-05-15T00:00:00'));
    expect(getDDay('2026-05-20')).toBe(5);
  });

  it('출발일 당일은 0을 반환한다', () => {
    vi.setSystemTime(new Date('2026-05-20T09:00:00'));
    expect(getDDay('2026-05-20')).toBe(0);
  });

  it('이미 지난 여행은 null을 반환한다', () => {
    vi.setSystemTime(new Date('2026-05-25T00:00:00'));
    expect(getDDay('2026-05-20')).toBeNull();
  });

  it('유효하지 않은 날짜 문자열이면 크래시 없이 null을 반환한다', () => {
    expect(getDDay('110120-02-06')).toBeNull();
  });
});
