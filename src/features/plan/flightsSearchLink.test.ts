import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Airport } from './airports/airportData';

const listAirports = vi.fn<() => Promise<Airport[]>>();
vi.mock('./airports/airportService', () => ({ listAirports: () => listAirports() }));
const { openFlightsSearchForTrip, resetFlightAirportsCache } = await import('./flightsSearchLink');
const { takeFlightsAutoSearch } = await import('./flightsAutoSearch');

afterEach(() => {
  resetFlightAirportsCache();
  sessionStorage.clear();
});

const airport = (iata: string, lat: number, lng: number): Airport => ({ iata, country_code: 'XX', name: { en: iata }, city: { en: iata }, lat, lng, timezone: 'UTC' });
const AIRPORTS = [airport('ICN', 37.46, 126.44), airport('GMP', 37.56, 126.79), airport('SYD', -33.94, 151.18)];
beforeEach(() => {
  // 모의 함수를 그대로 돌려주면 vitest가 정리 함수로 불러 버린다
  listAirports.mockResolvedValue(AIRPORTS);
});

const sydneyTrip = {
  city: '오스트레일리아 뉴사우스웨일스 주 시드니',
  city_lat: -33.8688,
  city_lng: 151.2093,
  start_date: '2026-10-07',
  end_date: '2026-10-14',
};

describe('openFlightsSearchForTrip — 항공 탭을 채워서 열고 한 번 바로 검색(모든 언어)', () => {
  const realLocation = window.location;
  const assign = vi.fn();

  beforeEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: { ...realLocation, assign } });
    assign.mockReset();
  });
  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: realLocation });
  });

  it('서울(모든 공항) → 여행지에 가장 가까운 공항·날짜로 항공 탭을 열고 자동 검색 표시를 남긴다', async () => {
    await openFlightsSearchForTrip(sydneyTrip);
    expect(assign).toHaveBeenCalledTimes(1);
    const url = new URL(String(assign.mock.calls[0][0]), 'https://triptic.my');
    expect(url.pathname).toBe('/flights');
    expect(Object.fromEntries(url.searchParams)).toEqual({ origin: 'SEL', destination: 'SYD', adults: '1', depart_date: '2026-10-07', return_date: '2026-10-14' });
    // 표시는 한 번만 읽힌다 — 새로고침하면 자동 검색이 아니다
    expect(takeFlightsAutoSearch()).toBe(true);
    expect(takeFlightsAutoSearch()).toBe(false);
  });

  it('도착지를 못 정하면(150km 안에 공항 없음) 날짜만 채운 검색 폼으로 — 자동 검색 표시 없음', async () => {
    listAirports.mockResolvedValue(AIRPORTS.filter((a) => a.iata !== 'SYD'));
    await openFlightsSearchForTrip(sydneyTrip);
    expect(assign).toHaveBeenCalledWith('/flights?depart_date=2026-10-07&return_date=2026-10-14');
    expect(takeFlightsAutoSearch()).toBe(false);
  });

  it('공항 목록을 못 받아도 날짜만 채운 폼으로 열린다', async () => {
    listAirports.mockRejectedValue(new Error('offline'));
    await openFlightsSearchForTrip(sydneyTrip);
    expect(assign).toHaveBeenCalledWith('/flights?depart_date=2026-10-07&return_date=2026-10-14');
    expect(takeFlightsAutoSearch()).toBe(false);
  });
});
