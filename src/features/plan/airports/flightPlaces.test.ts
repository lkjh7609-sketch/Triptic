import { describe, expect, it } from 'vitest';
import type { Airport } from './airportData';
import { flightPlaceForCode, flightPlaceForTrip, searchFlightPlaces } from './flightPlaces';

const ap = (iata: string, country: string, ko: string, en: string, cityKo: string, cityEn: string, lat: number, lng: number): Airport => ({
  iata,
  country_code: country,
  name: { ko, en },
  city: { ko: cityKo, en: cityEn },
  lat,
  lng,
  timezone: 'UTC',
});

const AIRPORTS: Airport[] = [
  ap('ICN', 'KR', '인천국제공항', 'Incheon International Airport', '서울', 'Seoul', 37.46, 126.44),
  ap('GMP', 'KR', '김포국제공항', 'Gimpo International Airport', '서울', 'Seoul', 37.56, 126.79),
  ap('NRT', 'JP', '나리타국제공항', 'Narita International Airport', '도쿄', 'Tokyo', 35.77, 140.39),
  ap('HND', 'JP', '하네다공항', 'Haneda Airport', '도쿄', 'Tokyo', 35.55, 139.78),
  ap('FUK', 'JP', '후쿠오카공항', 'Fukuoka Airport', '후쿠오카', 'Fukuoka', 33.59, 130.45),
  ap('SYD', 'AU', '시드니공항', 'Sydney Airport', '시드니', 'Sydney', -33.94, 151.18),
];

describe('searchFlightPlaces', () => {
  it('공항이 여럿인 도시는 "모든 공항"(도시 코드)이 먼저, 그다음 그 도시의 공항', () => {
    const r = searchFlightPlaces(AIRPORTS, '도쿄', 'ko');
    expect(r[0]).toMatchObject({ code: 'TYO', type: 'city', name: '도쿄' });
    expect(r.slice(1).map((p) => p.code).sort()).toEqual(['HND', 'NRT']);
    expect(r[1]).toMatchObject({ type: 'airport', detail: '도쿄, JP' });
  });

  it('공항 하나인 도시는 공항만, 영어로도 찾는다', () => {
    expect(searchFlightPlaces(AIRPORTS, 'fukuoka', 'ko').map((p) => [p.code, p.type])).toEqual([['FUK', 'airport']]);
    expect(searchFlightPlaces(AIRPORTS, 'Seoul', 'en')[0]).toMatchObject({ code: 'SEL', name: 'Seoul' });
  });

  it('목록에 공항이 하나뿐이면 도시 코드를 만들지 않는다(오사카: 목록에 없음)', () => {
    expect(searchFlightPlaces(AIRPORTS, '오사카', 'ko')).toEqual([]);
  });
});

describe('flightPlaceForCode', () => {
  it('주소로 넘어온 코드에 이름을 붙인다', () => {
    expect(flightPlaceForCode(AIRPORTS, 'sel', 'ko')).toMatchObject({ code: 'SEL', type: 'city', name: '서울' });
    expect(flightPlaceForCode(AIRPORTS, 'SYD', 'ko')).toMatchObject({ code: 'SYD', type: 'airport', name: '시드니공항' });
    expect(flightPlaceForCode(AIRPORTS, 'XXX', 'ko')).toBeNull();
  });
});

describe('flightPlaceForTrip', () => {
  it('여행 좌표에 가장 가까운 공항, 공항 여럿인 도시면 도시 코드', () => {
    expect(flightPlaceForTrip(AIRPORTS, { city: '시드니', city_lat: -33.87, city_lng: 151.21 })).toEqual({ code: 'SYD', type: 'airport' });
    expect(flightPlaceForTrip(AIRPORTS, { city: '도쿄', city_lat: 35.68, city_lng: 139.76 })).toEqual({ code: 'TYO', type: 'city' });
  });

  it('150km 안에 공항이 없으면 null, 좌표가 없으면 도시 이름으로', () => {
    expect(flightPlaceForTrip(AIRPORTS, { city: 'Nowhere', city_lat: 0, city_lng: 0 })).toBeNull();
    expect(flightPlaceForTrip(AIRPORTS, { city: 'Fukuoka, Japan', city_lat: null, city_lng: null })).toEqual({ code: 'FUK', type: 'airport' });
  });
});
