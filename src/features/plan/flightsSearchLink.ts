import { cityDisplayName } from './cityName';
import { haversineKm } from './map/geo';

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

/**
 * 여행 도시·날짜로 항공 탭(/flights) 검색 주소를 만든다 — 항공 위젯은 시작할 때만
 * origin/destination/depart_date/return_date를 읽으므로 같은 창 전체 이동으로 연다.
 * 출발지나 도착지를 못 정하면 빈 항공 탭으로.
 */
export async function flightsSearchUrlForTrip(trip: TripForFlights): Promise<string> {
  try {
    const [origin, destination] = await Promise.all([originIata(), destinationIata(trip)]);
    if (!origin || !destination || origin === destination || !trip.start_date) return '/flights';
    const params = new URLSearchParams({ origin, destination, depart_date: trip.start_date, adults: '1' });
    if (trip.end_date && trip.end_date > trip.start_date) params.set('return_date', trip.end_date);
    return `/flights?${params.toString()}`;
  } catch {
    return '/flights';
  }
}

export async function openFlightsSearchForTrip(trip: TripForFlights): Promise<void> {
  window.location.assign(await flightsSearchUrlForTrip(trip));
}
