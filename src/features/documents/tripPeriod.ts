/**
 * 예약 서류의 항공편 날짜가 여행 기간과 다를 때(검수 창 "여행 기간과 날짜가 달라요").
 *
 * 일정 저장(trip-itinerary-write)은 출발일이 여행 기간 안에 있는 항공편만 일차에 배정해 저장한다 —
 * 기간 밖 항공편은 반영해도 저장되지 않고 사라진다. 그래서 먼저 여행 기간을 항공권에 맞출지,
 * 지금 기간을 유지할지(기간 밖 항공편은 넣지 않음) 사용자가 고르게 한다.
 */
import type { ParsedFlight } from './parseBooking/schema.ts';

export interface Period {
  start: string;
  end: string;
}

function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000);
}

const departureDate = (f: ParsedFlight): string | null => f.departure.scheduledLocal.value?.slice(0, 10) ?? null;

/** 항공편 출발일이 여행 기간 밖인지(날짜를 모르면 false) */
export function isFlightOutsideTrip(flight: ParsedFlight, trip: Period): boolean {
  const d = departureDate(flight);
  return !!d && (d < trip.start || d > trip.end);
}

/**
 * 항공편이 하나라도 여행 기간 밖이면, 항공권에 맞춘 새 여행 기간을 낸다(아니면 null).
 *  - 두 편 이상: 첫 편 출발일 ~ 마지막 편 출발일(귀국편이 뜨는 날이 여행 마지막 날)
 *  - 편도 하나: 여행 일수는 그대로 두고 옮긴다 — 시작일 쪽에 가까우면 그날 시작, 아니면 그날 끝
 */
export function proposeTripPeriod(flights: ParsedFlight[], trip: Period): Period | null {
  const dates = flights.map(departureDate).filter((d): d is string => !!d).sort();
  if (dates.length === 0 || !dates.some((d) => d < trip.start || d > trip.end)) return null;
  if (dates.length >= 2) return { start: dates[0], end: dates[dates.length - 1] };
  const d = dates[0];
  const span = daysBetween(trip.start, trip.end);
  const nearStart = Math.abs(daysBetween(trip.start, d)) <= Math.abs(daysBetween(d, trip.end));
  return nearStart ? { start: d, end: addDays(d, span) } : { start: addDays(d, -span), end: d };
}

export function totalDaysOf(period: Period): number {
  return daysBetween(period.start, period.end) + 1;
}

/** 일차별 기록(일정·숙소·식사·가계부) 중 newTotal일차 뒤에 내용이 있는 일차 — 기간이 줄면 지워진다 */
export function daysWithContentAfter(newTotal: number, sources: unknown[]): number[] {
  const days = new Set<number>();
  for (const src of sources) {
    if (!src || typeof src !== 'object') continue;
    for (const [key, value] of Object.entries(src as Record<string, unknown>)) {
      const day = Number(key);
      if (!Number.isInteger(day) || day <= newTotal) continue;
      const hasContent = Array.isArray(value) ? value.length > 0 : value && typeof value === 'object' ? Object.values(value).some(Boolean) : !!value;
      if (hasContent) days.add(day);
    }
  }
  return [...days].sort((a, b) => a - b);
}
