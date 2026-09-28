import { afterEach, describe, expect, it, vi } from 'vitest';
import { flightsSearchUrlForTrip } from './flightsSearchLink';

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
