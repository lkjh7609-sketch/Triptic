import { differenceInCalendarDays, isWithinInterval, parseISO, startOfDay } from 'date-fns';

export type TripPhase = 'ongoing' | 'upcoming' | 'past';

/** 여행 목록 섹션 분류 (02-screens.md §3.1: 예정 / 진행 중 / 지난 여행) */
export function getTripPhase(startDate: string | null, endDate: string | null): TripPhase {
  if (!startDate || !endDate) return 'upcoming';
  const today = startOfDay(new Date());
  const start = startOfDay(parseISO(startDate));
  const end = startOfDay(parseISO(endDate));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'upcoming';
  if (isWithinInterval(today, { start, end })) return 'ongoing';
  if (today < start) return 'upcoming';
  return 'past';
}

/** D-day. 여행 중이면 null (D-day 배지는 예정 여행에만 표시, 02-screens.md §2.1 참고) */
export function getDDay(startDate: string | null): number | null {
  if (!startDate) return null;
  const today = startOfDay(new Date());
  const start = startOfDay(parseISO(startDate));
  if (Number.isNaN(start.getTime())) return null;
  const diff = differenceInCalendarDays(start, today);
  return diff >= 0 ? diff : null;
}

/**
 * 종료일이 지난 여행은 목적지·날짜를 못 바꾼다(서버 트리거 0069가 실제 경계 — 종료일 + 1일 뒤부터).
 * 지난 여행을 고쳐 새 여행처럼 다시 쓰는 한도 우회를 막는 규칙이고, 일정 내용 편집은 그대로 된다.
 */
export function isTripDatesLocked(endDate: string | null | undefined, now: Date = new Date()): boolean {
  if (!endDate) return false;
  const end = startOfDay(parseISO(endDate));
  if (Number.isNaN(end.getTime())) return false;
  return differenceInCalendarDays(startOfDay(now), end) > 1;
}
