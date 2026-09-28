import { describe, it, expect } from 'vitest';
import { commitFlightBooking, dayIndexForDate } from './commitBooking';
import type { ParsedFlight } from './parseBooking/schema';

function field<T>(value: T | null, confidence = 0.95) {
  return { value, confidence };
}

function makeFlight(overrides: Partial<ParsedFlight> = {}): ParsedFlight {
  return {
    kind: 'flight',
    carrierIata: field('KE'),
    carrierName: field('Korean Air'),
    flightNumber: field('KE801'),
    departure: {
      airportIata: field('ICN'),
      airportName: field('Incheon International Airport'),
      terminal: field(null),
      scheduledLocal: field('2026-05-20T08:00'),
      airportLat: 37.4691,
      airportLng: 126.451,
    },
    arrival: {
      airportIata: field('NRT'),
      airportName: field('Narita International Airport'),
      terminal: field(null),
      scheduledLocal: field('2026-05-20T11:00'),
      airportLat: 35.7686,
      airportLng: 140.3887,
    },
    bookingReference: field('ABC123'),
    seat: field(null),
    cabinClass: field(null),
    ...overrides,
  };
}

describe('commitFlightBooking', () => {
  it('여행 시작일에 가까운 출발이면 outbound로 판정한다', () => {
    const result = commitFlightBooking(makeFlight(), '2026-05-20', '2026-05-23');
    expect(result?.slot).toBe('outbound');
    expect(result?.flight.flightNo).toBe('KE801');
    expect(result?.flight.dep.iata).toBe('ICN');
    expect(result?.flight.dep.lat).toBeCloseTo(37.4691, 2);
    expect(result?.flight.arr.iata).toBe('NRT');
  });

  it('여행 종료일에 가까운 도착이면 return으로 판정한다', () => {
    const result = commitFlightBooking(
      makeFlight({
        departure: {
          ...makeFlight().departure,
          scheduledLocal: field('2026-05-23T18:00'),
        },
        arrival: {
          ...makeFlight().arrival,
          scheduledLocal: field('2026-05-23T21:00'),
        },
      }),
      '2026-05-20',
      '2026-05-23',
    );
    expect(result?.slot).toBe('return');
  });

  it('공항 코드나 시각이 없으면 커밋할 수 없다(null)', () => {
    const result = commitFlightBooking(
      makeFlight({ departure: { ...makeFlight().departure, airportIata: field(null) } }),
      '2026-05-20',
      '2026-05-23',
    );
    expect(result).toBeNull();
  });
});

describe('dayIndexForDate', () => {
  it('여행 시작일은 1일차다', () => {
    expect(dayIndexForDate('2026-05-20', '2026-05-20', 4)).toBe(1);
  });

  it('여행 기간 밖이면 null', () => {
    expect(dayIndexForDate('2026-06-01', '2026-05-20', 4)).toBeNull();
  });
});

describe('commitFlightBooking — 출국/귀국 칸', () => {
  const leg = (fn: string, dep: string, depAt: string, arr: string, arrAt: string) =>
    makeFlight({
      flightNumber: field(fn),
      departure: { ...makeFlight().departure, airportIata: field(dep), scheduledLocal: field(depAt) },
      arrival: { ...makeFlight().arrival, airportIata: field(arr), scheduledLocal: field(arrAt) },
    });
  // 여행(10/7~10/14)과 날짜가 다른 왕복 항공권 — 예전엔 둘 다 outbound로 들어가 덮어썼다
  const out = leg('RS717', 'ICN', '2026-07-17T19:05', 'KIX', '2026-07-17T20:50');
  const back = leg('RS714', 'KIX', '2026-07-20T16:15', 'ICN', '2026-07-20T18:25');

  it('같은 문서의 항공편은 출발 순서로 — 먼저 뜨는 편 출국, 나중 편 귀국', () => {
    expect(commitFlightBooking(out, '2026-10-07', '2026-10-14', { sameDocumentFlights: [back] })?.slot).toBe('outbound');
    expect(commitFlightBooking(back, '2026-10-07', '2026-10-14', { sameDocumentFlights: [out] })?.slot).toBe('return');
  });

  it('출국편이 이미 들어 있으면 그 뒤에 뜨는 편은 귀국', () => {
    const existing = { outbound: commitFlightBooking(out, '2026-10-07', '2026-10-14')!.flight, return: null };
    expect(commitFlightBooking(back, '2026-10-07', '2026-10-14', { existing })?.slot).toBe('return');
  });

  it('다구간은 첫 편 출국·마지막 편 귀국', () => {
    const mid = leg('LH1134', 'FRA', '2027-01-18T07:05', 'BCN', '2027-01-18T09:15');
    const first = leg('KE905', 'ICN', '2027-01-12T13:10', 'FRA', '2027-01-12T18:35');
    const last = leg('KE914', 'BCN', '2027-01-25T20:45', 'ICN', '2027-01-26T16:30');
    const ctx = (self: ParsedFlight) => ({ sameDocumentFlights: [first, mid, last].filter((f) => f !== self) });
    expect(commitFlightBooking(first, '2027-01-12', '2027-01-26', ctx(first))?.slot).toBe('outbound');
    expect(commitFlightBooking(last, '2027-01-12', '2027-01-26', ctx(last))?.slot).toBe('return');
  });
});
