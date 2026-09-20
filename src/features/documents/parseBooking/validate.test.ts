import { describe, it, expect } from 'vitest';
import airportsData from '../../../../data/airports.json';
import { createAirportIndex } from './airports';
import { verifyParsedFlight, verifyParsedLodging, isWithinTripRange } from './validate';
import type { ParsedFlight, ParsedLodging } from './schema';

const airports = createAirportIndex(airportsData);
const ctx = { airports, tripStartDate: '2026-05-20', tripEndDate: '2026-05-23' };

function field<T>(value: T | null, confidence = 0.95) {
  return { value, confidence };
}

function baseFlight(overrides: Partial<ParsedFlight> = {}): ParsedFlight {
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
    },
    arrival: {
      airportIata: field('NRT'),
      airportName: field('Narita International Airport'),
      terminal: field(null),
      scheduledLocal: field('2026-05-20T11:00'),
    },
    bookingReference: field('ABC123'),
    seat: field(null),
    cabinClass: field(null),
    ...overrides,
  };
}

describe('verifyParsedFlight', () => {
  it('§7.2 실제 예제(ICN 08:00 → NRT 11:00, 시차 없음에도 120분)를 정상 통과시킨다', () => {
    const { flight, warnings } = verifyParsedFlight(baseFlight(), ctx);
    expect(warnings).toEqual([]);
    expect(flight.departure.airportIata.value).toBe('ICN');
    expect(flight.arrival.airportIata.value).toBe('NRT');
  });

  it('커밋 시 지도 렌더링에 쓸 공항 좌표를 DB에서 채운다(추출값이 아니라 조회값)', () => {
    const { flight } = verifyParsedFlight(baseFlight(), ctx);
    expect(flight.departure.airportLat).toBeCloseTo(37.4691, 2);
    expect(flight.departure.airportLng).toBeCloseTo(126.451, 2);
    expect(flight.arrival.airportLat).toBeCloseTo(35.7686, 2);
    expect(flight.arrival.airportLng).toBeCloseTo(140.3887, 2);
  });

  it('실재하지 않는 공항 코드는 비우고 신뢰도를 0으로 만든다', () => {
    const { flight, warnings } = verifyParsedFlight(
      baseFlight({ departure: { ...baseFlight().departure, airportIata: field('ZZZ') } }),
      ctx,
    );
    expect(flight.departure.airportIata.value).toBeNull();
    expect(flight.departure.airportIata.confidence).toBe(0);
    expect(warnings.some((w) => w.includes('출발 공항'))).toBe(true);
  });

  it('도착이 출발보다 빠르면 신뢰도를 낮추고 경고한다', () => {
    const { warnings } = verifyParsedFlight(
      baseFlight({
        arrival: { ...baseFlight().arrival, scheduledLocal: field('2026-05-20T07:00') },
      }),
      ctx,
    );
    expect(warnings.some((w) => w.includes('도착 시각'))).toBe(true);
  });

  it('거리 대비 비행시간이 비정상이면(예: ICN→NRT인데 10시간) 경고한다', () => {
    const { warnings } = verifyParsedFlight(
      baseFlight({
        arrival: { ...baseFlight().arrival, scheduledLocal: field('2026-05-20T18:00') },
      }),
      ctx,
    );
    expect(warnings.some((w) => w.includes('비행 시간'))).toBe(true);
  });

  it('여행 기간 밖 날짜는 신뢰도를 낮추고 경고한다', () => {
    const { warnings } = verifyParsedFlight(
      baseFlight({
        departure: { ...baseFlight().departure, scheduledLocal: field('2026-01-01T08:00') },
        arrival: { ...baseFlight().arrival, scheduledLocal: field('2026-01-01T11:00') },
      }),
      ctx,
    );
    expect(warnings.some((w) => w.includes('여행 기간'))).toBe(true);
  });

  it('편명 형식이 이상하면 신뢰도를 0.3으로 낮춘다', () => {
    const { flight } = verifyParsedFlight(baseFlight({ flightNumber: field('not-a-flight-no') }), ctx);
    expect(flight.flightNumber.confidence).toBe(0.3);
  });
});

describe('verifyParsedLodging', () => {
  function baseLodging(overrides: Partial<ParsedLodging> = {}): ParsedLodging {
    return {
      kind: 'lodging',
      propertyName: field('Park Hyatt Tokyo'),
      address: field('3-7-1-2 Nishi Shinjuku'),
      checkInLocal: field('2026-05-20T15:00'),
      checkOutLocal: field('2026-05-22T11:00'),
      roomType: field(null),
      guestCount: field(2),
      bookingReference: field('XYZ789'),
      phone: field(null),
      ...overrides,
    };
  }

  it('정상 예약은 경고 없이 통과한다', () => {
    const { warnings } = verifyParsedLodging(baseLodging(), ctx);
    expect(warnings).toEqual([]);
  });

  it('체크아웃이 체크인보다 빠르면 경고한다', () => {
    const { warnings } = verifyParsedLodging(
      baseLodging({ checkOutLocal: field('2026-05-19T11:00') }),
      ctx,
    );
    expect(warnings.some((w) => w.includes('체크아웃'))).toBe(true);
  });
});

describe('isWithinTripRange', () => {
  it('여행 시작 하루 전/종료 하루 후까지는 허용한다', () => {
    expect(isWithinTripRange('2026-05-19T00:00', ctx)).toBe(true);
    expect(isWithinTripRange('2026-05-24T00:00', ctx)).toBe(true);
  });

  it('이틀 이상 벗어나면 범위 밖이다', () => {
    expect(isWithinTripRange('2026-05-17T00:00', ctx)).toBe(false);
  });
});
