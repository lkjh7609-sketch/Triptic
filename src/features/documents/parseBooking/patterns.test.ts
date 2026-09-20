import { describe, it, expect } from 'vitest';
import { resolveAmbiguousDayMonth, monthNameToNumber } from './patterns';

describe('resolveAmbiguousDayMonth', () => {
  it('한쪽이 12를 넘으면 그쪽을 일(day)로 확정한다', () => {
    // 20/05 — 20은 월일 수 없으므로 20일 5월
    expect(resolveAmbiguousDayMonth(20, 5, 2026, '2026-05-01', '2026-05-31')).toEqual({
      year: 2026,
      month: 5,
      day: 20,
      ambiguous: false,
    });
  });

  it('둘 다 12 이하로 모호하면 여행 기간 안에 드는 해석을 택한다', () => {
    // 05/06 — 5월6일 or 6월5일. 여행 기간이 5월이면 5월6일을 택한다
    const result = resolveAmbiguousDayMonth(5, 6, 2026, '2026-05-01', '2026-05-31');
    expect(result).toEqual({ year: 2026, month: 5, day: 6, ambiguous: false });
  });

  it('둘 다 여행 기간 안이면 임의로 고르지 않고 ambiguous를 표시한다', () => {
    const result = resolveAmbiguousDayMonth(5, 6, 2026, '2026-01-01', '2026-12-31');
    expect(result?.ambiguous).toBe(true);
  });

  it('둘 다 31을 넘으면 유효한 날짜가 아니므로 null', () => {
    expect(resolveAmbiguousDayMonth(32, 40, 2026, '2026-05-01', '2026-05-31')).toBeNull();
  });
});

describe('monthNameToNumber', () => {
  it('영문 월 약어를 숫자로 변환한다', () => {
    expect(monthNameToNumber('MAY')).toBe(5);
    expect(monthNameToNumber('jan')).toBe(1);
    expect(monthNameToNumber('DEC')).toBe(12);
  });

  it('알 수 없는 값은 null', () => {
    expect(monthNameToNumber('XYZ')).toBeNull();
  });
});
