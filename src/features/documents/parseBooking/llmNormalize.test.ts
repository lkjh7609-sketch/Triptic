import { describe, expect, it } from 'vitest';
import { ParsedBooking } from './schema';
import { normalizeLlmEnvelope } from './llmNormalize';

const f = (value: unknown, confidence = 0.9) => ({ value, confidence });

describe('normalizeLlmEnvelope', () => {
  it('필드 하나가 형식에 안 맞아도 응답 전체를 버리지 않고 그 필드만 고치거나 비운다', () => {
    const [b] = normalizeLlmEnvelope({
      flights: [
        {
          carrierIata: f('ba'),
          carrierName: f('British Airways'),
          flightNumber: f('BA 2714'),
          departure: { airportIata: f('lhr'), airportName: f('London Heathrow'), terminal: f('T5'), scheduledLocal: f('2026-10-10 07:25:00') },
          arrival: { airportIata: f('NCE'), airportName: f(null), terminal: f('Terminal 2'), scheduledLocal: f('2026-10-10T10:30:00+02:00') },
          bookingReference: f('QF7T9M'),
          seat: f(null),
          cabinClass: f('Economy'),
        },
      ],
      lodgings: [],
      rail: [],
      carRentals: [],
      activities: [],
    });
    expect(ParsedBooking.safeParse(b).success).toBe(true);
    if (b.kind !== 'flight') throw new Error('flight expected');
    expect(b.flightNumber.value).toBe('BA2714');
    expect(b.carrierIata.value).toBe('BA');
    expect(b.departure.airportIata.value).toBe('LHR');
    expect(b.departure.terminal.value).toBe('5');
    expect(b.arrival.terminal.value).toBe('2');
    expect(b.departure.scheduledLocal.value).toBe('2026-10-10T07:25');
    expect(b.arrival.scheduledLocal.value).toBe('2026-10-10T10:30');
    expect(b.cabinClass.value).toBe('economy');
  });

  it('고칠 수 없는 값은 그 필드만 null', () => {
    const [b] = normalizeLlmEnvelope({
      flights: [
        {
          flightNumber: f('Flight 12345'),
          departure: { airportIata: f('INCHEON'), scheduledLocal: f('2026-10-07 19:40') },
          arrival: { scheduledLocal: f('10/08 07:05') },
        },
      ],
    });
    if (b.kind !== 'flight') throw new Error('flight expected');
    expect(b.flightNumber).toEqual({ value: null, confidence: 0 });
    expect(b.departure.airportIata).toEqual({ value: null, confidence: 0 });
    expect(b.arrival.scheduledLocal).toEqual({ value: null, confidence: 0 });
    expect(b.departure.scheduledLocal.value).toBe('2026-10-07T19:40');
  });

  it('값만 온 필드({value} 없이)도 받고, 날짜만 있으면 T00:00에 신뢰도 0.3 이하', () => {
    const [b] = normalizeLlmEnvelope({
      lodgings: [{ propertyName: 'Hotel Le Negresco', checkInLocal: { value: '2026-10-10', confidence: 0.95 }, checkOutLocal: '2026-10-14T12:00', guestCount: '2 adults' }],
    });
    if (b.kind !== 'lodging') throw new Error('lodging expected');
    expect(b.propertyName).toEqual({ value: 'Hotel Le Negresco', confidence: 0.5 });
    expect(b.checkInLocal).toEqual({ value: '2026-10-10T00:00', confidence: 0.3 });
    expect(b.checkOutLocal.value).toBe('2026-10-14T12:00');
    expect(b.guestCount.value).toBe(2);
  });

  it('좌석 등급 표기 매핑', () => {
    const cls = (v: string) => {
      const [b] = normalizeLlmEnvelope({ flights: [{ flightNumber: f('KE401'), cabinClass: f(v) }] });
      return b.kind === 'flight' ? b.cabinClass.value : null;
    };
    expect(cls('일반석 (Y)')).toBe('economy');
    expect(cls('Premium Economy')).toBe('premium_economy');
    expect(cls('비즈니스')).toBe('business');
    expect(cls('FIRST')).toBe('first');
    expect(cls('Y')).toBe('economy');
  });

  it('빈 껍데기 항목은 빼고, kind가 붙은 bookings 배열도 받는다', () => {
    const out = normalizeLlmEnvelope({
      flights: [{ flightNumber: f(null), departure: {}, arrival: {} }],
      bookings: [{ kind: 'rail', trainNumber: f('KTX 023'), departure: { stationName: f('서울'), scheduledLocal: f('2026-12-31T06:00') }, arrival: {} }],
    });
    expect(out.map((b) => b.kind)).toEqual(['rail']);
    expect(ParsedBooking.safeParse(out[0]).success).toBe(true);
  });

  it('JSON이 아닌 모양이면 빈 배열', () => {
    expect(normalizeLlmEnvelope(null)).toEqual([]);
    expect(normalizeLlmEnvelope('oops')).toEqual([]);
    expect(normalizeLlmEnvelope({ flights: 'x' })).toEqual([]);
  });
});
