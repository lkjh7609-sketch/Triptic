import { describe, expect, it } from 'vitest';
import type { ParsedFlight } from './parseBooking/schema';
import { daysWithContentAfter, isFlightOutsideTrip, proposeTripPeriod, totalDaysOf } from './tripPeriod';

const f = <T,>(value: T | null) => ({ value, confidence: 0.9 });
const flight = (depAt: string): ParsedFlight => ({
  kind: 'flight',
  carrierIata: f('RS'),
  carrierName: f(null),
  flightNumber: f('RS717'),
  departure: { airportIata: f('ICN'), airportName: f(null), terminal: f(null), scheduledLocal: f(depAt) },
  arrival: { airportIata: f('KIX'), airportName: f(null), terminal: f(null), scheduledLocal: f(null) },
  bookingReference: f(null),
  seat: f(null),
  cabinClass: f(null),
});
const trip = { start: '2026-10-07', end: '2026-10-14' };

describe('tripPeriod', () => {
  it('왕복이 여행 기간 밖이면 첫 편 출발일 ~ 마지막 편 출발일', () => {
    expect(proposeTripPeriod([flight('2026-07-20T16:15'), flight('2026-07-17T19:05')], trip)).toEqual({ start: '2026-07-17', end: '2026-07-20' });
  });

  it('모두 기간 안이면 제안하지 않는다(귀국편이 마지막 날 출발해도)', () => {
    expect(proposeTripPeriod([flight('2026-10-07T19:40'), flight('2026-10-14T09:30')], trip)).toBeNull();
  });

  it('귀국편만 하루 늦게 뜨면 끝나는 날을 늘린다', () => {
    expect(proposeTripPeriod([flight('2026-10-07T19:40'), flight('2026-10-15T01:10')], trip)).toEqual({ start: '2026-10-07', end: '2026-10-15' });
  });

  it('편도 하나는 여행 일수를 유지한 채 옮긴다', () => {
    expect(proposeTripPeriod([flight('2026-10-05T09:00')], trip)).toEqual({ start: '2026-10-05', end: '2026-10-12' });
    expect(proposeTripPeriod([flight('2026-10-20T09:00')], trip)).toEqual({ start: '2026-10-13', end: '2026-10-20' });
  });

  it('출발일 모르면 판단하지 않음', () => {
    expect(isFlightOutsideTrip(flight(null as unknown as string), trip)).toBe(false);
    expect(proposeTripPeriod([], trip)).toBeNull();
  });

  it('기간이 줄면 지워질 일차', () => {
    expect(totalDaysOf({ start: '2026-07-17', end: '2026-07-20' })).toBe(4);
    const data = { 1: [{ name: 'a' }], 5: [{ name: 'b' }], 6: [] };
    const meals = { 7: { lunch: { name: 'c' } }, 8: { lunch: null } };
    expect(daysWithContentAfter(4, [data, meals])).toEqual([5, 7]);
    expect(daysWithContentAfter(8, [data, meals])).toEqual([]);
  });
});
