import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Airport } from './airports/airportData';

const listAirports = vi.fn<() => Promise<Airport[]>>();
vi.mock('./airports/airportService', () => ({ listAirports: () => listAirports() }));
const { openFlightsSearchForTrip, resetFlightAirportsCache } = await import('./flightsSearchLink');

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);
afterEach(() => {
  fetchMock.mockReset();
  resetFlightAirportsCache();
});

const airport = (iata: string, lat: number, lng: number): Airport => ({ iata, country_code: 'XX', name: { en: iata }, city: { en: iata }, lat, lng, timezone: 'UTC' });
const AIRPORTS = [airport('ICN', 37.46, 126.44), airport('GMP', 37.56, 126.79), airport('SYD', -33.94, 151.18)];
beforeEach(() => listAirports.mockResolvedValue(AIRPORTS));

const sydneyTrip = {
  city: '오스트레일리아 뉴사우스웨일스 주 시드니',
  city_lat: -33.8688,
  city_lng: 151.2093,
  start_date: '2026-10-07',
  end_date: '2026-10-14',
};

describe('openFlightsSearchForTrip — 한국어는 마이리얼트립', () => {
  const realLocation = window.location;
  const assign = vi.fn();
  const tab = { opener: {}, location: { href: '' }, close: vi.fn() };

  beforeEach(() => {
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    Object.defineProperty(window, 'location', { configurable: true, value: { ...realLocation, assign } });
    tab.location.href = '';
    tab.close.mockReset();
    assign.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'location', { configurable: true, value: realLocation });
  });

  it('누르는 순간 탭을 열고, 서울(모든 공항) → 여행지에 가장 가까운 공항·날짜로 받은 마이링크로 보낸다', async () => {
    fetchMock.mockImplementation(async () => ({ ok: true, json: async () => ({ url: 'https://myrealt.rip/abc' }) }));
    await openFlightsSearchForTrip(sydneyTrip, 'ko');
    expect(window.open).toHaveBeenCalledWith('', '_blank');
    expect(tab.opener).toBeNull();
    expect(tab.location.href).toBe('https://myrealt.rip/abc');
    const linkCall = String(fetchMock.mock.calls.find((c) => String(c[0]).includes('/api/partnerLink'))?.[0]);
    const params = new URLSearchParams(linkCall.split('?')[1]);
    expect(Object.fromEntries(params)).toEqual({
      brand: 'myrealtrip',
      kind: 'flight',
      origin: 'SEL',
      origin_type: 'city',
      destination: 'SYD',
      destination_type: 'airport',
      depart_date: '2026-10-07',
      return_date: '2026-10-14',
      adults: '1',
      placement: 'trip_flights',
    });
  });

  it('도착지를 못 정하면(150km 안에 공항 없음) 연 탭을 닫고 항공 탭 폼으로(날짜는 채워서)', async () => {
    listAirports.mockResolvedValue(AIRPORTS.filter((a) => a.iata !== 'SYD'));
    await openFlightsSearchForTrip(sydneyTrip, 'ko');
    expect(tab.close).toHaveBeenCalled();
    expect(assign).toHaveBeenCalledWith('/flights?depart_date=2026-10-07&return_date=2026-10-14');
  });

  it('미리 받아 둔 링크가 있으면 서버를 기다리지 않고 바로 연다', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      tab.location.href = this.href;
    });
    await openFlightsSearchForTrip(sydneyTrip, 'ko', 'https://myrealt.rip/ready');
    expect(click).toHaveBeenCalledTimes(1);
    expect(tab.location.href).toBe('https://myrealt.rip/ready');
    expect(window.open).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('한국어가 아니면 탭을 열지 않고 날짜를 채운 항공 탭(Kayak 검색)으로', async () => {
    await openFlightsSearchForTrip(sydneyTrip, 'en');
    expect(window.open).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(assign).toHaveBeenCalledWith('/flights?depart_date=2026-10-07&return_date=2026-10-14');
  });
});
