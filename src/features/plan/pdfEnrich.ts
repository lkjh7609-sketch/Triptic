/**
 * PDF 일정표에 넣을 바깥 정보 — 내보낼 때 브라우저에서 Google에 묻는다(실패하면 없이 그린다).
 *  · 숙소 전화번호·주소: 여행 데이터에 전화번호가 없어 Places(findPlaceFromQuery → getDetails)로 찾는다
 *  · 장소 사이 대중교통 수단·시간: Directions(TRANSIT). 지도 화면이 받아 둔 결과(sharedDirectionsCache)가 있으면 그것을 쓴다.
 *    Google이 대중교통 경로를 안 주는 곳(한국 등)·실패는 직선거리로 어림(1.2km 이하 도보, 그 밖 대중교통)
 *  · 동선 지도 배경: Static Maps — 웹사이트 베이지 톤, 글자·아이콘 없이 땅·물·길 모양만(사용자: '대충이라도 지도 모양')
 */
import { loadGoogleMaps, loadGoogleMapsPlaces } from '@/shared/api/googleMapsLoader';
import { sharedDirectionsCache } from './map/useTripRoutes';
import { mercatorFit, type LatLng, type MercatorFit } from './pdfLayout';

export interface HotelContact {
  phone: string;
  address: string;
}

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);
}

/** 숙소 이름(+좌표) → 전화번호·주소. 못 찾으면 빈 값 */
export async function hotelContact(name: string, at: { lat?: number | null; lng?: number | null }): Promise<HotelContact> {
  const empty = { phone: '', address: '' };
  try {
    const { PlacesService } = await loadGoogleMapsPlaces();
    const service = new PlacesService(document.createElement('div'));
    const bias = typeof at.lat === 'number' && typeof at.lng === 'number' ? { center: { lat: at.lat, lng: at.lng }, radius: 2000 } : undefined;
    const placeId = await withTimeout(
      new Promise<string | null>((resolve) =>
        service.findPlaceFromQuery({ query: name, fields: ['place_id'], ...(bias ? { locationBias: bias } : {}) }, (res, status) =>
          resolve(status === google.maps.places.PlacesServiceStatus.OK ? (res?.[0]?.place_id ?? null) : null),
        ),
      ),
      6000,
      null,
    );
    if (!placeId) return empty;
    return await withTimeout(
      new Promise<HotelContact>((resolve) =>
        service.getDetails({ placeId, fields: ['international_phone_number', 'formatted_phone_number', 'formatted_address'] }, (d, status) =>
          resolve(
            status === google.maps.places.PlacesServiceStatus.OK && d
              ? { phone: d.international_phone_number || d.formatted_phone_number || '', address: d.formatted_address || '' }
              : empty,
          ),
        ),
      ),
      6000,
      empty,
    );
  } catch {
    return empty;
  }
}

export type TransitMode = 'walk' | 'subway' | 'bus' | 'train' | 'tram' | 'ferry' | 'cable' | 'transit' | 'metroOrBus';

export interface TransitHop {
  modes: TransitMode[];
  minutes: number;
  /** Google 경로가 아니라 직선거리 어림 */
  estimated: boolean;
}

const VEHICLE: Record<string, TransitMode> = {
  SUBWAY: 'subway',
  METRO_RAIL: 'subway',
  BUS: 'bus',
  INTERCITY_BUS: 'bus',
  TROLLEYBUS: 'bus',
  SHARE_TAXI: 'bus',
  RAIL: 'train',
  HEAVY_RAIL: 'train',
  COMMUTER_TRAIN: 'train',
  HIGH_SPEED_TRAIN: 'train',
  LONG_DISTANCE_TRAIN: 'train',
  TRAM: 'tram',
  LIGHT_RAIL: 'tram',
  MONORAIL: 'tram',
  FERRY: 'ferry',
  CABLE_CAR: 'cable',
  GONDOLA_LIFT: 'cable',
  FUNICULAR: 'cable',
};

/** Directions 결과 → 탈것(순서대로, 겹치면 한 번)과 걸리는 분 */
export function summarizeRoute(result: google.maps.DirectionsResult): TransitHop | null {
  const leg = result.routes?.[0]?.legs?.[0];
  if (!leg?.duration) return null;
  const modes: TransitMode[] = [];
  for (const step of leg.steps ?? []) {
    if (step.travel_mode !== 'TRANSIT') continue;
    const type = String(step.transit?.line?.vehicle?.type ?? '');
    const mode = VEHICLE[type] ?? 'transit';
    if (modes.at(-1) !== mode) modes.push(mode);
  }
  return { modes: modes.length ? modes : ['walk'], minutes: Math.max(1, Math.round(leg.duration.value / 60)), estimated: false };
}

/**
 * 직선거리 어림 — Google이 대중교통 경로를 안 주는 곳(일본·한국은 API로 대중교통 경로가 나오지 않는다, 2026-10-04 확인)과 실패할 때.
 * 1.2km 이하 도보(분당 75m), 25km 이하 지하철·버스(시속 20km + 기다림 10분), 그보다 멀면 기차(시속 60km + 20분)
 */
export function estimateHop(a: LatLng, b: LatLng): TransitHop {
  const k = Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  const km = Math.hypot((a.lat - b.lat) * 111.32, (a.lng - b.lng) * 111.32 * k);
  if (km <= 1.2) return { modes: ['walk'], minutes: Math.max(1, Math.round((km * 1000) / 75)), estimated: true };
  if (km <= 25) return { modes: ['metroOrBus'], minutes: Math.round(10 + (km / 20) * 60), estimated: true };
  return { modes: ['train'], minutes: Math.round(20 + km), estimated: true };
}

/** 두 곳 사이 대중교통 — 받아 둔 경로 → Directions → 어림 순 */
export async function transitHop(a: LatLng, b: LatLng): Promise<TransitHop> {
  const cached = sharedDirectionsCache.get(a, b);
  if (cached) {
    if (cached.status === 'OK') return summarizeRoute(cached.result) ?? estimateHop(a, b);
    return estimateHop(a, b);
  }
  try {
    await loadGoogleMaps();
    const service = new google.maps.DirectionsService();
    const result = await withTimeout(
      new Promise<google.maps.DirectionsResult | null>((resolve) =>
        service.route({ origin: a, destination: b, travelMode: google.maps.TravelMode.TRANSIT }, (r, status) =>
          resolve(status === 'OK' && r?.routes?.length ? r : null),
        ),
      ),
      7000,
      null,
    );
    if (result) {
      const leg = result.routes[0].legs[0];
      sharedDirectionsCache.setHit(a, b, result, leg?.duration?.text ?? '', leg?.distance?.text ?? '');
      return summarizeRoute(result) ?? estimateHop(a, b);
    }
    sharedDirectionsCache.setMiss(a, b);
  } catch {
    // 지도 라이브러리를 못 불러왔다
  }
  return estimateHop(a, b);
}

/** 웹사이트 베이지 톤의 지도 스타일 — 글자·아이콘 없이 모양만 */
const MAP_STYLE = [
  'feature:all|element:labels|visibility:off',
  'feature:poi|visibility:off',
  'feature:transit|visibility:off',
  'feature:administrative|visibility:off',
  'feature:landscape|color:0xF3EFE6',
  'feature:landscape.man_made|color:0xEFEADF',
  'feature:poi.park|element:geometry|visibility:on',
  'feature:poi.park|element:geometry|color:0xE2E8D6',
  'feature:water|color:0xD6E2E3',
  'feature:road|element:geometry|color:0xFFFFFF',
  'feature:road.highway|element:geometry|color:0xF9F4EA',
  'feature:road.highway|element:geometry.stroke|color:0xE7DFCF',
  'feature:road.local|element:geometry|color:0xF7F4EC',
];

export interface MapBackground {
  fit: MercatorFit;
  /** PNG 데이터 주소 — 못 받으면 null(베이지 바탕만) */
  image: string | null;
}

/** 점들에 맞춘 지도(정수 줌·Web Mercator)와 그 배경 그림. size는 Static Maps 픽셀(최대 640) */
export async function mapBackground(points: LatLng[], size: { w: number; h: number }, padPx: { x: number; y: number }): Promise<MapBackground> {
  const fit = mercatorFit(points, size.w, size.h, padPx);
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  if (!key || points.length === 0) return { fit, image: null };
  const params = new URLSearchParams({
    center: `${fit.center.lat.toFixed(6)},${fit.center.lng.toFixed(6)}`,
    zoom: String(fit.zoom),
    size: `${size.w}x${size.h}`,
    scale: '2',
    key,
  });
  const url = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}&${MAP_STYLE.map((s) => `style=${s.replaceAll('|', '%7C')}`).join('&')}`;
  try {
    const res = await withTimeout(fetch(url), 8000, null);
    if (!res || !res.ok) return { fit, image: null };
    const blob = await res.blob();
    const image = await new Promise<string | null>((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(typeof fr.result === 'string' ? fr.result : null);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
    return { fit, image };
  } catch {
    return { fit, image: null };
  }
}
