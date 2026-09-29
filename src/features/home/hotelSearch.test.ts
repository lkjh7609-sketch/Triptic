import { describe, expect, it } from 'vitest';
import type { Destination } from '@/features/community/types';
import { hotelDestinations, matchDestinations, nearestDestination, nightsBetween } from './hotelSearch';
import { TRIP_HOTEL_CITY_IDS } from './tripHotelCities';

function dest(slug: string, name: string, country: string, lat: number, lng: number, extra: Partial<Destination> = {}): Destination {
  return { id: slug, slug, name, country_code: country, lat, lng, timezone: 'UTC', currency: null, cover_url: null, is_featured: false, sort_order: 50, post_count: 0, ...extra };
}

const tokyo = dest('tokyo', '도쿄', 'JP', 35.6762, 139.6503, { is_featured: true, sort_order: 0 });
const osaka = dest('osaka', '오사카', 'JP', 34.6937, 135.5023, { is_featured: true, sort_order: 1 });
const kyoto = dest('kyoto', '교토', 'JP', 35.0116, 135.7681, { sort_order: 2 });
const paris = dest('paris', '파리', 'FR', 48.8566, 2.3522, { sort_order: 32 });
const country = (code: string) => ({ JP: '일본', FR: '프랑스' })[code] ?? code;
const all = [paris, kyoto, tokyo, osaka];

describe('트립닷컴 도시 번호', () => {
  it('여행지 100곳 전부 번호가 있고, 도쿄는 트립닷컴 검색창이 만든 주소의 228', () => {
    expect(Object.keys(TRIP_HOTEL_CITY_IDS)).toHaveLength(100);
    expect(TRIP_HOTEL_CITY_IDS.tokyo).toBe(228);
    // 같은 번호를 두 도시에 쓰면 한 도시로 열리는 사고 — 겹치지 않는다
    expect(new Set(Object.values(TRIP_HOTEL_CITY_IDS)).size).toBe(100);
  });

  it('번호가 없는 여행지는 검색 목록에서 빠진다', () => {
    const unknown = dest('atlantis', '아틀란티스', 'XX', 0, 0);
    expect(hotelDestinations([tokyo, unknown]).map((d) => d.slug)).toEqual(['tokyo']);
  });
});

describe('matchDestinations', () => {
  it('비어 있으면 추천 여행지를 먼저, 정렬 순서대로', () => {
    expect(matchDestinations(all, '', country).map((d) => d.slug)).toEqual(['tokyo', 'osaka', 'kyoto', 'paris']);
  });

  it('이름이 그 글자로 시작하는 것을 먼저, 나라 이름으로도 찾는다', () => {
    expect(matchDestinations(all, '도', country).map((d) => d.slug)).toEqual(['tokyo']);
    expect(matchDestinations(all, '일본', country).map((d) => d.slug)).toEqual(['tokyo', 'osaka', 'kyoto']);
    expect(matchDestinations(all, 'PARIS', country).map((d) => d.slug)).toEqual(['paris']);
    expect(matchDestinations(all, '없는도시', country)).toEqual([]);
  });

  it('개수를 제한한다', () => {
    expect(matchDestinations(all, '', country, 2)).toHaveLength(2);
  });
});

describe('nearestDestination', () => {
  it('50km 안에서 가장 가까운 여행지, 멀면 null', () => {
    expect(nearestDestination(all, 35.7, 139.7)?.slug).toBe('tokyo');
    expect(nearestDestination(all, 35.0, 135.75)?.slug).toBe('kyoto');
    expect(nearestDestination(all, 37.5665, 126.978)).toBeNull(); // 서울 — 목록에 없음
  });
});

describe('nightsBetween', () => {
  it('박 수 — 같은 날·아직 안 고른 체크아웃은 0', () => {
    expect(nightsBetween('2026-10-01', '2026-10-02')).toBe(1);
    expect(nightsBetween('2026-10-01', '2026-10-04')).toBe(3);
    expect(nightsBetween('2026-10-01', '2026-10-01')).toBe(0);
    expect(nightsBetween('2026-10-01', '')).toBe(0);
    expect(nightsBetween('2026-10-05', '2026-10-01')).toBe(0);
  });
});
