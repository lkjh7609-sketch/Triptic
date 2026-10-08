import { useQuery } from '@tanstack/react-query';
import { aiLocale } from '@/shared/api/aiCacheKeys';
import { listAirports } from './airports/airportService';
import { DEFAULT_ORIGIN_CODE, flightPlaceForTrip, type FlightPlace } from './airports/flightPlaces';
import { fetchMyrealtripFlightsLink, fetchTrackedMyrealtripLink, flightLinkParams, openExternal, openInNewTab } from './partnerLinks';

/**
 * 항공 검색 제휴사 — 마이리얼트립은 한국어·원화 사이트뿐이라 한국어 사용자만.
 * 그 외 언어는 아직 연결된 항공 검색이 없어('none') 항공 탭이 '준비 중' 안내를 보여 준다.
 */
export type FlightsProvider = 'myrealtrip' | 'none';

export function flightsProviderFor(language: string): FlightsProvider {
  return aiLocale(language) === 'ko' ? 'myrealtrip' : 'none';
}

interface TripForFlights {
  city: string | null;
  city_lat: number | null;
  city_lng: number | null;
  start_date: string | null;
  end_date: string | null;
}

/** 공항 목록(약 300곳) — 한 번 받아 둔다(실패하면 다음에 다시) */
let airportsPromise: ReturnType<typeof listAirports> | null = null;
function airports() {
  airportsPromise ??= listAirports().catch((err: unknown) => {
    airportsPromise = null;
    throw err;
  });
  return airportsPromise;
}

/** 시험용 — 받아 둔 공항 목록을 비운다 */
export function resetFlightAirportsCache(): void {
  airportsPromise = null;
}

interface TripFlight {
  origin: string;
  originType: FlightPlace['type'];
  destination: string;
  destinationType: FlightPlace['type'];
  departDate: string;
  returnDate: string | null;
}

/**
 * 여행 → 출발(서울, 모든 공항)·도착(여행 좌표에 가장 가까운 공항, 공항 여럿인 도시면 도시 코드)과 날짜.
 * 예전엔 출발지를 접속 위치(트래블페이아웃 whereami)로, 도착지를 트래블페이아웃 자동완성으로 정했다. 하나라도 못 정하면 null
 */
async function resolveTripFlight(trip: TripForFlights): Promise<TripFlight | null> {
  if (!trip.start_date) return null;
  const destination = flightPlaceForTrip(await airports(), trip);
  if (!destination || destination.code === DEFAULT_ORIGIN_CODE) return null;
  const returnDate = trip.end_date && trip.end_date > trip.start_date ? trip.end_date : null;
  return {
    origin: DEFAULT_ORIGIN_CODE,
    originType: 'city',
    destination: destination.code,
    destinationType: destination.type,
    departDate: trip.start_date,
    returnDate,
  };
}

/** 여행 → 마이리얼트립 항공 결과 링크 요청 값 */
async function tripFlightParams(trip: TripForFlights): Promise<Record<string, string> | null> {
  const flight = await resolveTripFlight(trip);
  return flight ? flightLinkParams({ ...flight, adults: 1 }, 'trip_flights') : null;
}

/**
 * "이 일정으로 항공권 찾기" 링크를 미리 받아 둔다(한국어, 출발 전 여행) — 누르면 바로 열리게.
 * 마이리얼트립 링크라 1시간 지나면 다시 받는다. 못 정하면 null.
 */
export function useTripFlightsLink(trip: TripForFlights, language: string, enabled: boolean): string | null | undefined {
  const { data } = useQuery({
    queryKey: ['tripFlightsLink', trip.city, trip.city_lat, trip.city_lng, trip.start_date, trip.end_date],
    queryFn: async () => {
      const params = await tripFlightParams(trip);
      return params ? fetchTrackedMyrealtripLink(params) : null;
    },
    enabled: enabled && !!trip.start_date && flightsProviderFor(language) === 'myrealtrip',
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
  return data;
}

/**
 * "이 일정으로 항공권 찾기". 한국어 사용자는 마이리얼트립 검색 결과를 새 탭으로 바로 연다
 * (출발은 서울, 도착은 여행지 공항). 코드를 못 정하거나 링크를 못 받으면 항공 탭
 * 검색 폼으로 — 날짜는 채워 둔다. 그 외 언어는 항공 탭(준비 중 안내)으로.
 */
export async function openFlightsSearchForTrip(trip: TripForFlights, language: string, prefetchedUrl?: string | null): Promise<void> {
  if (flightsProviderFor(language) === 'myrealtrip' && prefetchedUrl) {
    openExternal(prefetchedUrl);
    return;
  }
  if (flightsProviderFor(language) === 'none') {
    // 연결된 항공 검색이 없으니 항공 탭(준비 중 안내)으로 — 날짜는 주소에 담아 둔다
    const dates = new URLSearchParams();
    if (trip.start_date) dates.set('depart_date', trip.start_date);
    if (trip.end_date && trip.start_date && trip.end_date > trip.start_date) dates.set('return_date', trip.end_date);
    window.location.assign(`/flights${dates.size ? `?${dates.toString()}` : ''}`);
    return;
  }
  const opened = await openInNewTab(async () => {
    const flight = await resolveTripFlight(trip);
    if (!flight) return null;
    return fetchMyrealtripFlightsLink({ ...flight, adults: 1 }, 'trip_flights');
  });
  if (opened) return;
  const params = new URLSearchParams();
  if (trip.start_date) params.set('depart_date', trip.start_date);
  if (trip.end_date && trip.start_date && trip.end_date > trip.start_date) params.set('return_date', trip.end_date);
  window.location.assign(`/flights${params.size ? `?${params.toString()}` : ''}`);
}
