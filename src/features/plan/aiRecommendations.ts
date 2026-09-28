import { getSupabaseClient } from '@/shared/api/supabaseClient';
import { apiUrl } from '@/shared/api/apiUrl';
import { aiLocale, nearbyCacheKeys } from '@/shared/api/aiCacheKeys';

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
}

export function nearbyRecsQueryKey({ placeName, city, locale }: Pick<NearbyInput, 'placeName' | 'city' | 'locale'>) {
  const { cityKey, placeKey } = nearbyCacheKeys(placeName, city);
  return ['ai', 'nearby', aiLocale(locale), cityKey, placeKey] as const;
}

/** 좌표 없이 저장된 추천(서버 Google 키가 없던 때 생성분)이 섞여 있는지 */
export function needsServerCoords(recs: ApiRecommendation[]): boolean {
  return recs.some((r) => (r.lat == null || r.lng == null) && !r.coordsChecked);
}

/** /api/recommend — 캐시에 없으면 AI로 생성, 있으면 빠진 좌표를 서버가 채워 캐시에 되돌려 쓴 결과 */
export async function requestNearbyFromServer(input: NearbyInput): Promise<ApiRecommendation[]> {
  const res = await fetch(apiUrl('/api/recommend'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ placeName: input.placeName, city: input.city, category: 'all', locale: input.locale, lat: input.lat, lng: input.lng }),
  });
  if (!res.ok) throw new Error(`recommend HTTP ${res.status}`);
  const json = (await res.json()) as { recommendations?: ApiRecommendation[] };
  return json.recommendations ?? [];
}

/** 1) DB 캐시(0049) → 2) 없을 때만 /api/recommend(LLM으로 한 번 생성하고 서버가 DB에 영구 저장) */
export async function fetchNearbyRecommendations(input: NearbyInput): Promise<ApiRecommendation[]> {
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
