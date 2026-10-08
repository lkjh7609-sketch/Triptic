import { describe, expect, it } from 'vitest';
import { hotelSearchParams, nightsBetween, parseHotelSearch } from './hotelSearch';

describe('호텔 검색 조건 ↔ 주소', () => {
  const search = { name: '방콕', lat: 13.7563, lng: 100.5018, checkin: '2026-11-20', checkout: '2026-11-22', adults: 3, childAges: [5, 9] };

  it('주소에 담았다가 그대로 읽는다', () => {
    expect(parseHotelSearch(hotelSearchParams(search))).toEqual(search);
  });

  it('좌표·날짜가 없거나 틀리면 null(아직 검색 전)', () => {
    const p = (o: Record<string, string>) => new URLSearchParams({ ...Object.fromEntries(hotelSearchParams(search)), ...o });
    expect(parseHotelSearch(new URLSearchParams())).toBeNull();
    expect(parseHotelSearch(p({ lat: '' }))).toBeNull();
    expect(parseHotelSearch(p({ lat: '100' }))).toBeNull();
    expect(parseHotelSearch(p({ lng: 'x' }))).toBeNull();
    expect(parseHotelSearch(p({ checkout: '2026-11-20' }))).toBeNull();
    expect(parseHotelSearch(p({ checkin: '11/20' }))).toBeNull();
  });

  it('인원은 범위 안으로 다듬고, 아이 나이는 0~17만 4명까지', () => {
    const q = parseHotelSearch(new URLSearchParams({ ...Object.fromEntries(hotelSearchParams(search)), adults: '99', ages: '3|40|7|8|9|10' }))!;
    expect(q.adults).toBe(8);
    expect(q.childAges).toEqual([3, 7, 8, 9]);
  });

  it('박 수', () => {
    expect(nightsBetween('2026-11-20', '2026-11-23')).toBe(3);
  });
});
