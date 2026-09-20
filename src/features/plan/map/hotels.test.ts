import { describe, it, expect } from 'vitest';
import { getEffectiveHotel, getDayHotels, type Hotel } from './hotels';

const tokyoHotel: Hotel = { name: '다이이치 호텔 도쿄', lat: 35.6762, lng: 139.6503 };
const osakaHotel: Hotel = { name: '오사카 호텔', lat: 34.6937, lng: 135.5023 };

describe('getEffectiveHotel', () => {
  it('해당 일차에 숙소가 있으면 그대로 반환', () => {
    expect(getEffectiveHotel(2, { 2: tokyoHotel })).toEqual(tokyoHotel);
  });

  it('숙소가 없는 날은 이전 날짜의 숙소를 상속한다', () => {
    expect(getEffectiveHotel(3, { 1: tokyoHotel })).toEqual(tokyoHotel);
  });

  it('더 최근에 지정된 숙소를 우선한다', () => {
    expect(getEffectiveHotel(4, { 1: tokyoHotel, 3: osakaHotel })).toEqual(osakaHotel);
  });

  it('어떤 이전 날짜에도 숙소가 없으면 null', () => {
    expect(getEffectiveHotel(3, {})).toBeNull();
  });

  it('이름이 없는 숙소 항목은 무시한다', () => {
    expect(getEffectiveHotel(2, { 2: { name: '', lat: 0, lng: 0 }, 1: tokyoHotel })).toEqual(
      tokyoHotel,
    );
  });
});

describe('getDayHotels', () => {
  it('1일차는 startHotel이 없다 (이전 날이 없으므로)', () => {
    const { startHotel } = getDayHotels(1, 4, { 1: tokyoHotel });
    expect(startHotel).toBeNull();
  });

  it('마지막 날은 endHotel이 없다 (다음 이동이 없으므로)', () => {
    const { endHotel } = getDayHotels(4, 4, { 1: tokyoHotel });
    expect(endHotel).toBeNull();
  });

  it('중간 날짜는 전날 숙소가 출발점, 당일 숙소가 도착점', () => {
    const { startHotel, endHotel } = getDayHotels(2, 4, { 1: tokyoHotel, 2: osakaHotel });
    expect(startHotel).toEqual(tokyoHotel);
    expect(endHotel).toEqual(osakaHotel);
  });
});
