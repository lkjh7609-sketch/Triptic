import { listAirports } from './airports/airportService';
import { DEFAULT_ORIGIN_CODE, flightPlaceForTrip, type FlightPlace } from './airports/flightPlaces';
import { markFlightsAutoSearch } from './flightsAutoSearch';

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

/**
 * "이 일정으로 항공권 찾기" — 항공 탭을 열어 출발(서울, 모든 공항)·도착(여행지 가장 가까운 공항)·날짜를 채우고
 * 우리 화면 안에서 바로 한 번 검색한다(모든 언어). 도착지를 못 정하면 날짜만 채운 검색 폼으로 — 이때는 자동 검색 없음.
 */
export async function openFlightsSearchForTrip(trip: TripForFlights): Promise<void> {
  const flight = await resolveTripFlight(trip).catch(() => null);
  const params = new URLSearchParams();
  if (flight) {
    params.set('origin', flight.origin);
    params.set('destination', flight.destination);
    params.set('adults', '1');
    markFlightsAutoSearch();
  }
  if (trip.start_date) params.set('depart_date', trip.start_date);
  if (trip.end_date && trip.start_date && trip.end_date > trip.start_date) params.set('return_date', trip.end_date);
  window.location.assign(`/flights${params.size ? `?${params.toString()}` : ''}`);
}
