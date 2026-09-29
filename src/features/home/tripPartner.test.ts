import { describe, expect, it } from 'vitest';
import { tripHotelSearchUrl, type TripHotelSearch } from './tripPartner';

const tokyo: TripHotelSearch = { cityId: 228, cityName: '도쿄', checkIn: '2026-10-01', checkOut: '2026-10-02', adults: 2, rooms: 1 };

describe('tripHotelSearchUrl', () => {
  it('트립닷컴 검색창이 만든 주소와 같은 구조 — 도쿄(228) 한국어', () => {
    const url = new URL(tripHotelSearchUrl(tokyo, 'ko'));
    expect(url.origin + url.pathname).toBe('https://kr.trip.com/hotels/list');
    expect(url.searchParams.get('city')).toBe('228');
    expect(url.searchParams.get('cityName')).toBe('도쿄');
    expect(url.searchParams.get('searchWord')).toBe('도쿄');
    expect(url.searchParams.get('searchType')).toBe('CT');
    expect(url.searchParams.get('checkIn')).toBe('2026-10-01');
    expect(url.searchParams.get('checkOut')).toBe('2026-10-02');
    expect(url.searchParams.get('adult')).toBe('2');
    expect(url.searchParams.get('children')).toBe('0');
    expect(url.searchParams.get('crn')).toBe('1');
  });

  it('파트너 센터가 붙여 준 제휴 값을 그대로 유지한다', () => {
    const url = new URL(tripHotelSearchUrl(tokyo, 'ko'));
    expect(url.searchParams.get('Allianceid')).toBe('10792895');
    expect(url.searchParams.get('SID')).toBe('332524291');
    expect(url.searchParams.get('trip_sub1')).toBe('home_hotels');
    expect(url.searchParams.get('trip_sub3')).toBe('D20018770');
  });

  it('도시별·계정별 값은 짐작으로 넣지 않는다', () => {
    const url = new URL(tripHotelSearchUrl(tokyo, 'ko'));
    for (const key of ['countryId', 'provinceId', 'districtId', 'searchValue', 'searchCoordinate', 'lat', 'lon', 'barCurr', 'domestic']) {
      expect(url.searchParams.has(key)).toBe(false);
    }
  });

  it('표시 언어에 맞는 지역 사이트로 — 브라우저 언어 태그(en-US·ja-JP·zh-HK)도 앱 언어로 맞춘다', () => {
    expect(new URL(tripHotelSearchUrl(tokyo, 'en')).host).toBe('www.trip.com');
    expect(new URL(tripHotelSearchUrl(tokyo, 'en-US')).host).toBe('www.trip.com');
    expect(new URL(tripHotelSearchUrl(tokyo, 'ja-JP')).host).toBe('jp.trip.com');
    expect(new URL(tripHotelSearchUrl(tokyo, 'zh-HK')).host).toBe('tw.trip.com');
    expect(new URL(tripHotelSearchUrl(tokyo, 'fr')).host).toBe('kr.trip.com');
  });

  it('도시 이름은 주소에 안전하게 인코딩되고 객실·성인 수가 그대로 간다', () => {
    const raw = tripHotelSearchUrl({ ...tokyo, cityId: 192, cityName: 'New York & Co', adults: 4, rooms: 2 }, 'en');
    expect(raw).not.toContain('New York & Co');
    const url = new URL(raw);
    expect(url.searchParams.get('cityName')).toBe('New York & Co');
    expect(url.searchParams.get('adult')).toBe('4');
    expect(url.searchParams.get('crn')).toBe('2');
  });
});
