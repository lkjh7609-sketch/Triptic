import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flightsSearchUrlForTrip, openFlightsSearchForTrip } from './flightsSearchLink';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);
afterEach(() => fetchMock.mockReset());

function respond(whereami: unknown, places: unknown) {
  fetchMock.mockImplementation(async (url: string) => ({
    ok: true,
    json: async () => (url.includes('whereami') ? whereami : places),
  }));
}

const sydneyTrip = {
  city: '오스트레일리아 뉴사우스웨일스 주 시드니',
  city_lat: -33.8688,
  city_lng: 151.2093,
  start_date: '2026-10-07',
  end_date: '2026-10-14',
};

describe('flightsSearchUrlForTrip', () => {
  it('출발지(IP) + 여행 좌표에 가까운 같은 이름 도시 + 날짜로 검색 주소', async () => {
    respond({ iata: 'SEL' }, [
      { code: 'YQY', coordinates: { lat: 46.13, lon: -60.19 } }, // 캐나다 시드니
      { code: 'SYD', coordinates: { lat: -33.86, lon: 151.2 } },
    ]);
    const url = await flightsSearchUrlForTrip(sydneyTrip);
    expect(url).toBe('/flights?origin=SEL&destination=SYD&depart_date=2026-10-07&adults=1&return_date=2026-10-14');
    expect(String(fetchMock.mock.calls.find((c) => String(c[0]).includes('places2'))?.[0])).toContain('term=%EC%8B%9C%EB%93%9C%EB%8B%88');
  });

  it('출발지를 모르거나, 도착지가 없거나, 같으면 빈 항공 탭', async () => {
    respond({}, [{ code: 'SYD', coordinates: { lat: -33.86, lon: 151.2 } }]);
    expect(await flightsSearchUrlForTrip(sydneyTrip)).toBe('/flights');
    respond({ iata: 'SYD' }, [{ code: 'SYD', coordinates: { lat: -33.86, lon: 151.2 } }]);
    expect(await flightsSearchUrlForTrip(sydneyTrip)).toBe('/flights');
    respond({ iata: 'SEL' }, [{ code: 'YQY', coordinates: { lat: 46.13, lon: -60.19 } }]);
    expect(await flightsSearchUrlForTrip(sydneyTrip)).toBe('/flights');
  });

  it('당일치기(귀국일 없음/같은 날)는 편도', async () => {
    respond({ iata: 'SEL' }, [{ code: 'OSA', coordinates: { lat: 34.69, lon: 135.5 } }]);
    const url = await flightsSearchUrlForTrip({ city: 'Osaka, Japan', city_lat: 34.69, city_lng: 135.5, start_date: '2026-11-01', end_date: '2026-11-01' });
    expect(url).toBe('/flights?origin=SEL&destination=OSA&depart_date=2026-11-01&adults=1');
  });
});

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

  it('누르는 순간 탭을 열고, 도시 코드·날짜로 받은 마이링크로 보낸다', async () => {
    fetchMock.mockImplementation(async (url: string) => ({
      ok: true,
      json: async () =>
        url.includes('whereami')
          ? { iata: 'SEL' }
          : url.includes('places2')
            ? [{ code: 'SYD', coordinates: { lat: -33.86, lon: 151.2 } }]
            : { url: 'https://myrealt.rip/abc' },
    }));
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
      destination_type: 'city',
      depart_date: '2026-10-07',
      return_date: '2026-10-14',
      adults: '1',
      placement: 'trip_flights',
    });
  });

  it('도착지를 못 정하면 연 탭을 닫고 항공 탭 폼으로(날짜는 채워서)', async () => {
    respond({ iata: 'SEL' }, []);
    await openFlightsSearchForTrip(sydneyTrip, 'ko');
    expect(tab.close).toHaveBeenCalled();
    expect(assign).toHaveBeenCalledWith('/flights?depart_date=2026-10-07&return_date=2026-10-14');
  });

  it('한국어가 아니면 탭을 열지 않고 항공 탭 위젯 검색으로', async () => {
    respond({ iata: 'SEL' }, [{ code: 'SYD', coordinates: { lat: -33.86, lon: 151.2 } }]);
    await openFlightsSearchForTrip(sydneyTrip, 'en');
    expect(window.open).not.toHaveBeenCalled();
    expect(assign).toHaveBeenCalledWith('/flights?origin=SEL&destination=SYD&depart_date=2026-10-07&adults=1&return_date=2026-10-14');
  });
});
