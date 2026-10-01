import { describe, expect, it } from 'vitest';
import { monthCells, monthsFrom, parseYmd, pickDate, toYmd, tripLength } from './dateRangeCalendar';

describe('dateRangeCalendar', () => {
  it('문자열 날짜를 현지 날짜로 읽고 되돌린다(하루 어긋나지 않는다)', () => {
    const d = parseYmd('2026-10-12')!;
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 9, 12]);
    expect(toYmd(d)).toBe('2026-10-12');
    expect(parseYmd('')).toBeNull();
    expect(parseYmd('nope')).toBeNull();
  });

  it('달력 칸 — 앞은 요일만큼 비고 날짜는 1일부터 끝날까지', () => {
    const cells = monthCells(new Date(2026, 9, 1)); // 2026-10-01은 목요일
    expect(cells.slice(0, 4)).toEqual([null, null, null, null]);
    expect(cells[4]?.getDate()).toBe(1);
    expect(cells.filter(Boolean)).toHaveLength(31);
  });

  it('달 목록은 이번 달부터 이어진다(해가 바뀌어도)', () => {
    expect(monthsFrom(new Date(2026, 10, 20), 3).map((m) => `${m.getFullYear()}-${m.getMonth() + 1}`)).toEqual(['2026-11', '2026-12', '2027-1']);
  });

  it('박·일 수', () => {
    expect(tripLength(new Date(2026, 9, 12), new Date(2026, 9, 16))).toEqual({ nights: 4, days: 5 });
    expect(tripLength(new Date(2026, 9, 12), new Date(2026, 9, 12))).toEqual({ nights: 0, days: 1 });
  });

  it('날짜를 차례로 누르면 출발일 → 복귀일, 앞 날을 누르면 출발일을 다시 잡는다', () => {
    expect(pickDate({ start: null, end: null }, '2026-10-12')).toEqual({ start: '2026-10-12', end: null });
    expect(pickDate({ start: '2026-10-12', end: null }, '2026-10-16')).toEqual({ start: '2026-10-12', end: '2026-10-16' });
    expect(pickDate({ start: '2026-10-12', end: null }, '2026-10-12')).toEqual({ start: '2026-10-12', end: '2026-10-12' });
    expect(pickDate({ start: '2026-10-12', end: null }, '2026-10-05')).toEqual({ start: '2026-10-05', end: null });
    expect(pickDate({ start: '2026-10-12', end: '2026-10-16' }, '2026-11-01')).toEqual({ start: '2026-11-01', end: null });
  });
});
