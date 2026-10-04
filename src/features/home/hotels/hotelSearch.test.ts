import { describe, expect, it } from 'vitest';
import { hotelSearchParams, nightsBetween, parseHotelSearch } from './hotelSearch';

describe('hotelSearch', () => {
  const s = { destination: 'kplace:22327', name: '오사카', checkin: '2026-11-20', checkout: '2026-11-23', adults: 3, rooms: 2, childAges: [5, 9] };

  it('조건 ↔ 주소가 왕복된다', () => {
    expect(parseHotelSearch(hotelSearchParams(s))).toEqual(s);
  });

  it('틀린 주소는 검색 전(null) — 목적지 모양, 날짜 모양, 체크아웃이 앞', () => {
    expect(parseHotelSearch(new URLSearchParams('dest=Osaka&checkin=2026-11-20&checkout=2026-11-23'))).toBeNull();
    expect(parseHotelSearch(new URLSearchParams('dest=kplace:1&checkin=11/20&checkout=2026-11-23'))).toBeNull();
    expect(parseHotelSearch(new URLSearchParams('dest=kplace:1&checkin=2026-11-23&checkout=2026-11-20'))).toBeNull();
  });

  it('범위를 벗어난 인원·방은 맞추고, 어른은 방 수 이상', () => {
    const p = parseHotelSearch(new URLSearchParams('dest=kplace:1&checkin=2026-11-20&checkout=2026-11-21&rooms=9&adults=1&ages=3|x|99|7'));
    expect(p).toMatchObject({ rooms: 4, adults: 4, childAges: [3, 7] });
  });

  it('박 수', () => {
    expect(nightsBetween('2026-11-20', '2026-11-23')).toBe(3);
  });
});
