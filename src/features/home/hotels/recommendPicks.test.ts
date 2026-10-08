import { describe, expect, it } from 'vitest';
import type { TripRow } from '@/shared/api/tripService';
import type { Destination } from '@/features/community/types';
import { recommendedDestinations, tripSearchDates } from './recommendPicks';

const TODAY = '2026-10-08';
const trip = (over: Partial<TripRow>) => ({ id: 't', status: 'active', city: '시드니', city_lat: -33.87, city_lng: 151.2, start_date: '2026-10-14', end_date: '2026-10-22', ...over }) as unknown as TripRow;
const dest = (slug: string, lat: number, lng: number, over: Partial<Destination> = {}) =>
  ({ id: slug, slug, name: slug, lat, lng, cover_url: null, is_featured: true, sort_order: 0, ...over }) as unknown as Destination;
const name = (c: string) => c;

describe('tripSearchDates — 여행 날짜 → 호텔 검색 날짜', () => {
  it('앞으로의 여행은 그대로', () => {
    expect(tripSearchDates({ start_date: '2026-10-14', end_date: '2026-10-22' }, TODAY)).toEqual({ checkin: '2026-10-14', checkout: '2026-10-22' });
  });
  it('이미 떠난 여행은 오늘부터', () => {
    expect(tripSearchDates({ start_date: '2026-10-05', end_date: '2026-10-12' }, TODAY)).toEqual({ checkin: '2026-10-08', checkout: '2026-10-12' });
  });
  it('당일 여행·마지막 날인 여행도 체크아웃은 다음 날', () => {
    expect(tripSearchDates({ start_date: '2026-10-14', end_date: '2026-10-14' }, TODAY)).toEqual({ checkin: '2026-10-14', checkout: '2026-10-15' });
    expect(tripSearchDates({ start_date: '2026-10-05', end_date: '2026-10-08' }, TODAY)).toEqual({ checkin: '2026-10-08', checkout: '2026-10-09' });
  });
  it('끝난 여행·날짜 없는 여행은 null, 30박 넘으면 30박으로', () => {
    expect(tripSearchDates({ start_date: '2026-09-01', end_date: '2026-09-05' }, TODAY)).toBeNull();
    expect(tripSearchDates({ start_date: null, end_date: null }, TODAY)).toBeNull();
    expect(tripSearchDates({ start_date: '2026-11-01', end_date: '2027-01-30' }, TODAY)).toEqual({ checkin: '2026-11-01', checkout: '2026-12-01' });
  });
});

describe('recommendedDestinations — 내 일정 도시 우선, 모자라면 인기 도시', () => {
  it('내 일정(가까운 순)이 먼저이고 인기 도시로 채운다', () => {
    const out = recommendedDestinations(
      [trip({ id: 'b', city: '파리', city_lat: 48.85, city_lng: 2.35, start_date: '2026-12-01', end_date: '2026-12-05' }), trip({ id: 'a' })],
      [dest('tokyo', 35.67, 139.65), dest('bangkok', 13.75, 100.5)],
      TODAY,
      name,
    );
    expect(out.map((i) => i.name)).toEqual(['시드니', '파리', 'tokyo', 'bangkok']);
    expect(out[0]).toMatchObject({ fromTrip: true, dates: { checkin: '2026-10-14', checkout: '2026-10-22' } });
    expect(out[2]).toMatchObject({ fromTrip: false, dates: null });
  });

  it('일정이 없으면(비로그인 포함) 인기 도시만, 정렬 순서대로', () => {
    const out = recommendedDestinations([], [dest('b', 1, 1, { sort_order: 2 }), dest('a', 10, 10, { sort_order: 1 }), dest('x', 20, 20, { is_featured: false })], TODAY, name);
    expect(out.map((i) => i.name)).toEqual(['a', 'b']);
  });

  it('같은 도시는 한 번만 — 내 일정과 같은 도시의 인기 도시는 빠진다', () => {
    const out = recommendedDestinations([trip({})], [dest('sydney', -33.86, 151.21), dest('tokyo', 35.67, 139.65)], TODAY, name);
    expect(out.map((i) => i.name)).toEqual(['시드니', 'tokyo']);
  });

  it('보관된 여행·끝난 여행·좌표 없는 여행은 건너뛴다, 최대 6곳', () => {
    const trips = [trip({ id: '1', status: 'archived' }), trip({ id: '2', start_date: '2026-09-01', end_date: '2026-09-03' }), trip({ id: '3', city_lat: null })];
    const many = Array.from({ length: 10 }, (_, i) => dest(`d${i}`, i * 10, i * 10));
    const out = recommendedDestinations(trips, many, TODAY, name);
    expect(out).toHaveLength(6);
    expect(out.every((i) => !i.fromTrip)).toBe(true);
  });
});
