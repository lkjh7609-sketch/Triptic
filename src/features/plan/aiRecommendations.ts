import { getAccessToken, LoginRequiredError } from '@/shared/api/authToken';
import { getSupabaseClient } from '@/shared/api/supabaseClient';
import { apiUrl } from '@/shared/api/apiUrl';
import { aiLocale, nearbyCacheKeys } from '@/shared/api/aiCacheKeys';
import { haversineKm } from './map/geo';

/** /api/recommend 응답(또는 DB 캐시 payload)의 추천 1건 */
export interface ApiRecommendation {
  name: string;
  category?: string;
  categoryLabel?: string;
  signatureMenu?: string;
  priceRange?: string;
  reason?: string;
  tip?: string;
  placeId?: string | null;
  lat?: number;
  lng?: number;
  address?: string;
  /** 브라우저에서 좌표를 찾았을 때만(이 기기 캐시) — 일정 추가 시 카테고리 추론용 */
  types?: string[];
  /** 서버가 Google에서 이미 찾아봄(좌표가 없으면 못 찾은 것) — 다시 찾지 않는다 */
  coordsChecked?: boolean;
}

interface NearbyInput {
  placeName: string;
  city: string;
  locale: string;
  lat?: number;
  lng?: number;
  /** 기준 장소 자신은 추천에서 뺀다 */
  placeId?: string | null;
}

/** 기준 좌표가 있으면 좌표(약 11m 단위)로, 없으면(도시 기준 추천) 이름으로 */
export function nearbyRecsQueryKey({ placeName, city, locale, lat, lng }: Omit<NearbyInput, 'placeId'>) {
  if (lat != null && lng != null) return ['ai', 'nearby-pool', aiLocale(locale), lat.toFixed(4), lng.toFixed(4)] as const;
  const { cityKey, placeKey } = nearbyCacheKeys(placeName, city);
  return ['ai', 'nearby', aiLocale(locale), cityKey, placeKey] as const;
}

/** 반경 안 추천이 이만큼 쌓여 있으면 AI를 부르지 않는다(api/recommend.js POOL_TARGET) */
export const NEARBY_TARGET = 5;

interface PoolRow {
  place_id: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  category: string;
  category_label: string | null;
  signature_menu: string | null;
  price_range: string | null;
  reason: string | null;
  tip: string | null;
  distance_m: number;
}

function poolRowToRec(row: PoolRow): ApiRecommendation {
  return {
    name: row.name,
    category: row.category,
    categoryLabel: row.category_label ?? '',
    signatureMenu: row.signature_menu ?? '',
    priceRange: row.price_range ?? '',
    reason: row.reason ?? '',
    tip: row.tip ?? '',
    placeId: row.place_id,
    lat: row.lat,
    lng: row.lng,
    address: row.address ?? '',
    coordsChecked: true,
  };
}

/** "주변" 추천 최대 거리(api/recommend.js MAX_DISTANCE_M과 같은 값) */
export const NEARBY_RADIUS_M = 1500;

/** 기준점에서 반경 밖 좌표 — AI가 다른 도시의 같은 이름 가게를 지어낸 경우(오사카역 → 도쿄 롯폰기) */
export function isOutOfRange(point: { lat?: number | null; lng?: number | null }, base: { lat: number; lng: number } | null): boolean {
  if (!base || point.lat == null || point.lng == null) return false;
  return haversineKm(base.lat, base.lng, point.lat, point.lng) * 1000 > NEARBY_RADIUS_M;
}

/** 좌표 없이 저장된 추천(서버 Google 키가 없던 때 생성분)이 섞여 있는지 */
export function needsServerCoords(recs: ApiRecommendation[]): boolean {
  return recs.some((r) => (r.lat == null || r.lng == null) && !r.coordsChecked);
}

/** 오늘의 AI 생성 한도(로그인 사용자별 하루)를 다 썼다 — 서버가 429(daily_limit)로 알려 준다 */
export class AiLimitError extends Error {
  constructor(readonly limit: number) {
    super('daily_limit');
    this.name = 'AiLimitError';
  }
}

/** /api/recommend — 캐시에 없으면 AI로 생성, 있으면 빠진 좌표를 서버가 채워 캐시에 되돌려 쓴 결과 */
export async function requestNearbyFromServer(input: NearbyInput): Promise<ApiRecommendation[]> {
  // AI 호출은 로그인 사용자에게만 열려 있다(api/recommend.js) — 토큰이 없으면 서버까지 가지 않는다
  const token = await getAccessToken();
  if (!token) throw new LoginRequiredError();
  const res = await fetch(apiUrl('/api/recommend'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      placeName: input.placeName,
      city: input.city,
      category: 'all',
      locale: input.locale,
      lat: input.lat,
      lng: input.lng,
      placeId: input.placeId ?? undefined,
    }),
  });
  if (res.status === 401) throw new LoginRequiredError();
  if (res.status === 429) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; limit?: number };
    if (body.error === 'daily_limit') throw new AiLimitError(body.limit ?? 0);
  }
  if (!res.ok) throw new Error(`recommend HTTP ${res.status}`);
  const json = (await res.json()) as { recommendations?: ApiRecommendation[] };
  return json.recommendations ?? [];
}

/**
 * 기준 좌표가 있으면: 1.5km 안 장소 풀(0050)에 5곳 이상 있으면 그대로(AI 없음), 모자라면
 * /api/recommend가 AI로 더 받아 반경 안 것만 풀에 쌓은 뒤 돌려준다.
 * 좌표가 없으면(도시 기준): 1) 이름별 DB 캐시(0049) → 2) 없을 때만 /api/recommend.
 */
export async function fetchNearbyRecommendations(input: NearbyInput): Promise<ApiRecommendation[]> {
  if (input.lat != null && input.lng != null) {
    try {
      const { data, error } = await getSupabaseClient().rpc('get_nearby_ai_places', {
        p_lat: input.lat,
        p_lng: input.lng,
        p_radius_m: NEARBY_RADIUS_M,
        p_locale: aiLocale(input.locale),
        p_limit: 11,
      });
      if (!error && Array.isArray(data)) {
        const rows = (data as PoolRow[]).filter((r) => r.place_id !== input.placeId && r.distance_m > 40).slice(0, 10);
        if (rows.length >= NEARBY_TARGET) return rows.map(poolRowToRec);
      }
    } catch {
      // RPC 네트워크 오류 등 — 서버로 넘어간다
    }
    return requestNearbyFromServer(input);
  }

  const { cityKey, placeKey } = nearbyCacheKeys(input.placeName, input.city);
  try {
    const { data, error } = await getSupabaseClient().rpc('get_ai_cache', {
      p_kind: 'nearby',
      p_city_key: cityKey,
      p_place_key: placeKey,
      p_category: 'all',
      p_locale: aiLocale(input.locale),
    });
    const cached = !error && data ? (data as { recommendations?: unknown }).recommendations : null;
    if (Array.isArray(cached) && cached.length > 0) return cached as ApiRecommendation[];
  } catch {
    // RPC 네트워크 오류 등 — 아래 API로 넘어간다
  }
  return requestNearbyFromServer(input);
}
