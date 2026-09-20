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
