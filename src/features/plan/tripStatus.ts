import { differenceInCalendarDays, isWithinInterval, parseISO, startOfDay } from 'date-fns';

export type TripPhase = 'ongoing' | 'upcoming' | 'past';

/** 여행 목록 섹션 분류 (02-screens.md §3.1: 예정 / 진행 중 / 지난 여행) */
export function getTripPhase(startDate: string | null, endDate: string | null): TripPhase {
  if (!startDate || !endDate) return 'upcoming';
  const today = startOfDay(new Date());
  const start = startOfDay(parseISO(startDate));
  const end = startOfDay(parseISO(endDate));
  if (isWithinInterval(today, { start, end })) return 'ongoing';
  if (today < start) return 'upcoming';
  return 'past';
}

/** D-day. 여행 중이면 null (D-day 배지는 예정 여행에만 표시, 02-screens.md §2.1 참고) */
export function getDDay(startDate: string | null): number | null {
  if (!startDate) return null;
  const today = startOfDay(new Date());
  const start = startOfDay(parseISO(startDate));
  const diff = differenceInCalendarDays(start, today);
  return diff >= 0 ? diff : null;
}
