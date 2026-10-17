import { describe, expect, it } from 'vitest';
import type { Airport } from '../plan/airports/airportData';
import type { LookupFill } from '../plan/flightLookup/applyLookup';
import type { ParsedFlight } from './parseBooking/schema';
import { fillAirportsByName, fillFromLookup, joinLocal, lookupQuery, matchAirportByName, splitLocal } from './reviewAutofill';

const ap = (iata: string, cityKo: string, nameKo: string, cc = 'JP'): Airport => ({
  iata,
  country_code: cc,
  name: { ko: nameKo },
  city: { ko: cityKo },
  lat: 1,
  lng: 2,
  timezone: 'Asia/Tokyo',
});
const list = [ap('KIX', '오사카', '간사이국제공항'), ap('ITM', '오사카', '이타미공항'), ap('ICN', '인천', '인천국제공항', 'KR')];

const f = <T,>(value: T | null) => ({ value, confidence: 0.5 });
function flight(dep: [string | null, string | null, string | null], arr: [string | null, string | null, string | null]): ParsedFlight {
  return {
    kind: 'flight',
    carrierIata: f('7C'),
    carrierName: f(null),
    flightNumber: f('RS 714'),
    departure: { airportIata: f(dep[0]), airportName: f(dep[1]), terminal: f(null), scheduledLocal: f(dep[2]) },
    arrival: { airportIata: f(arr[0]), airportName: f(arr[1]), terminal: f(null), scheduledLocal: f(arr[2]) },
    bookingReference: f(null),
    seat: f(null),
    cabinClass: f(null),
  };
}

describe('서류 인식 — 빈 칸 자동 채우기', () => {
  it('날짜·시각 나누기/합치기', () => {
    expect(splitLocal('2026-07-20T16:15:00')).toEqual({ date: '2026-07-20', time: '16:15' });
    expect(splitLocal(null)).toEqual({ date: '', time: '' });
    expect(joinLocal('2026-07-20', '')).toBe('2026-07-20T');
    expect(joinLocal('', '')).toBeNull();
  });

  it('공항 이름은 한 곳으로 좁혀질 때만 — 오사카만으로는 KIX·ITM 둘이라 안 채우고, 괄호 안 간사이·코드가 있으면 채운다', () => {
    expect(matchAirportByName('오사카', list)).toBeNull();
    expect(matchAirportByName('오사카(간사이)', list)?.iata).toBe('KIX');
    expect(matchAirportByName('Kansai Intl (KIX)', list)?.iata).toBe('KIX');
    expect(matchAirportByName('인천', list)?.iata).toBe('ICN');
    const out = fillAirportsByName(flight([null, '오사카(간사이)', null], ['ICN', 'Incheon', null]), list, 'ko');
    expect(out.departure.airportIata.value).toBe('KIX');
    expect(out.arrival.airportIata.value).toBe('ICN');
    const same = flight(['KIX', null, null], ['ICN', null, null]);
    expect(fillAirportsByName(same, list, 'ko')).toBe(same);
  });

  it('공항·시각이 비었고 편명·출발일이 있으면 조회, 결과로 빈 칸만 채운다(읽은 값은 그대로)', () => {
    const parsed = flight([null, '오사카', '2026-07-20T'], ['ICN', 'Incheon', '2026-07-20T18:30']);
    expect(lookupQuery(parsed)).toEqual({ flightNo: 'RS714', date: '2026-07-20' });
    expect(lookupQuery(flight(['KIX', null, '2026-07-20T16:15'], ['ICN', null, '2026-07-20T18:25']))).toBeNull();
    expect(lookupQuery(flight([null, null, null], [null, null, null]))).toBeNull();
    const fill: LookupFill = {
      flightNo: 'RS714',
      date: '2026-07-20',
      arrDate: null,
      airline: '에어서울',
      airlineCode: 'RS',
      dep: { airport: { iata: 'KIX', name: '오사카(일본) KIX', lat: 34.4, lng: 135.2 }, time: '16:15', terminal: null },
      arr: { airport: { iata: 'ICN', name: '인천(대한민국) ICN', lat: 37.4, lng: 126.4 }, time: '18:25', terminal: null },
    };
    const out = fillFromLookup(parsed, fill);
    expect(out.departure.airportIata.value).toBe('KIX');
    expect(out.departure.airportLat).toBe(34.4);
    expect(out.departure.scheduledLocal.value).toBe('2026-07-20T16:15');
    expect(out.arrival.airportName.value).toBe('Incheon');
    expect(out.arrival.scheduledLocal.value).toBe('2026-07-20T18:30');
  });
});
