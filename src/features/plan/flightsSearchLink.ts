import { useQuery } from '@tanstack/react-query';
import { aiLocale } from '@/shared/api/aiCacheKeys';
import { cityDisplayName } from './cityName';
import { haversineKm } from './map/geo';
import { fetchMyrealtripFlightsLink, fetchTrackedMyrealtripLink, flightLinkParams, openExternal, openInNewTab } from './partnerLinks';

/**
 * 항공 검색 제휴사 — 마이리얼트립은 한국어·원화 사이트뿐이라 한국어 사용자만.
 * 그 외 언어는 지금 항공 검색이 없다(트래블페이아웃 위젯을 2026-10-04에 뺐고 새 항공 검색 준비 중 — 항공 탭은 안내만).
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

interface Places2City {
  code?: string;
  coordinates?: { lat?: number; lon?: number } | null;
}

/** 지금 접속 위치에서 가장 가까운 도시 공항 코드(Travelpayouts whereami, IP 기준) */
async function originIata(): Promise<string | null> {
  const res = await fetch('https://www.travelpayouts.com/whereami?locale=en');
  if (!res.ok) return null;
  const json = (await res.json()) as { iata?: unknown };
  return typeof json.iata === 'string' && json.iata ? json.iata.toUpperCase() : null;
}

/**
 * 여행 도시 → 도시 공항 코드(Travelpayouts places2). 한국어로 저장된 도시는 ko로 찾는다.
 * 같은 이름의 다른 도시(시드니 → 호주/캐나다)가 섞이므로 여행 좌표에 가장 가까운 것을 고르고,
 * 150km 밖이면 못 찾은 것으로 본다.
 */
async function destinationIata(trip: TripForFlights): Promise<string | null> {
  const term = cityDisplayName(trip.city);
  if (!term) return null;
  const locale = /[\uAC00-\uD7A3]/.test(term) ? 'ko' : 'en';
  const params = new URLSearchParams({ term, locale });
  params.append('types[]', 'city');
  const res = await fetch(`https://autocomplete.travelpayouts.com/places2?${params.toString()}`);
  if (!res.ok) return null;
  const cities = ((await res.json()) as Places2City[]).filter((c) => typeof c.code === 'string' && c.code);
  if (cities.length === 0) return null;
  if (trip.city_lat == null || trip.city_lng == null) return cities[0].code!.toUpperCase();
  let best: { code: string; km: number } | null = null;
  for (const c of cities) {
    const lat = c.coordinates?.lat;
    const lon = c.coordinates?.lon;
    if (lat == null || lon == null) continue;
    const km = haversineKm(trip.city_lat, trip.city_lng, lat, lon);
    if (km <= 150 && (!best || km < best.km)) best = { code: c.code!.toUpperCase(), km };
  }
  return best?.code ?? null;
}

interface TripFlight {
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string | null;
}

/** 여행 → 출발(접속 위치)·도착 도시 코드와 날짜. 하나라도 못 정하면 null */
async function resolveTripFlight(trip: TripForFlights): Promise<TripFlight | null> {
  if (!trip.start_date) return null;
  const [origin, destination] = await Promise.all([originIata(), destinationIata(trip)]);
  if (!origin || !destination || origin === destination) return null;
  const returnDate = trip.end_date && trip.end_date > trip.start_date ? trip.end_date : null;
  return { origin, destination, departDate: trip.start_date, returnDate };
}

/** 여행 → 마이리얼트립 항공 결과 링크 요청 값(출발·도착은 whereami·places2 도시 코드) */
async function tripFlightParams(trip: TripForFlights): Promise<Record<string, string> | null> {
  const flight = await resolveTripFlight(trip);
  return flight ? flightLinkParams({ ...flight, originType: 'city', destinationType: 'city', adults: 1 }, 'trip_flights') : null;
}

/**
 * "이 일정으로 항공권 찾기" 링크를 미리 받아 둔다(한국어, 출발 전 여행) — 누르면 바로 열리게.
 * 출발지는 접속 위치라 1시간 지나면 다시 받는다. 못 정하면 null.
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
 * (whereami·places2 코드는 둘 다 도시 코드). 코드를 못 정하거나 링크를 못 받으면 항공 탭
 * 검색 폼으로 — 날짜는 채워 둔다. 그 외 언어는 항공 탭(준비 중 안내)으로.
 */
export async function openFlightsSearchForTrip(trip: TripForFlights, language: string, prefetchedUrl?: string | null): Promise<void> {
  if (flightsProviderFor(language) === 'myrealtrip' && prefetchedUrl) {
    openExternal(prefetchedUrl);
    return;
  }
  if (flightsProviderFor(language) === 'none') {
    window.location.assign('/flights');
    return;
  }
  const opened = await openInNewTab(async () => {
    const flight = await resolveTripFlight(trip);
    if (!flight) return null;
    return fetchMyrealtripFlightsLink({ ...flight, originType: 'city', destinationType: 'city', adults: 1 }, 'trip_flights');
  });
  if (opened) return;
  const params = new URLSearchParams();
  if (trip.start_date) params.set('depart_date', trip.start_date);
  if (trip.end_date && trip.start_date && trip.end_date > trip.start_date) params.set('return_date', trip.end_date);
  window.location.assign(`/flights${params.size ? `?${params.toString()}` : ''}`);
}
