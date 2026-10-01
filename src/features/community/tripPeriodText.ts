import type { TripRow } from '@/shared/api/tripService';

/** "2024.10.12 - 10.15 (4일)" — 날짜가 없는 일정은 일 수만. daysLabel은 "4일"처럼 이미 번역된 글자 */
export function formatTripPeriod(trip: Pick<TripRow, 'start_date' | 'end_date'>, daysLabel: string): string {
  if (!trip.start_date) return daysLabel;
  const start = trip.start_date.replaceAll('-', '.');
  const end = trip.end_date && trip.end_date !== trip.start_date ? ` - ${trip.end_date.slice(5).replace('-', '.')}` : '';
  return `${start}${end} (${daysLabel})`;
}
