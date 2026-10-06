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

/** 주변 추천 구성 — 식당 3 · 카페 3 · 볼거리/즐길거리 3(api/_lib/nearbyMix.js와 같은 규칙). 묶음마다 이만큼 쌓여 있으면 AI를 부르지 않는다 */
export const GROUP_SIZE = 3;
const GROUPS = ['restaurant', 'cafe', 'sight'] as const;
type Group = (typeof GROUPS)[number];

/** AI 카테고리(restaurant | cafe | culture | spot) → 구성 묶음. 문화·명소는 모두 '볼거리' */
export function groupOf(category: string | null | undefined): Group {
  return category === 'restaurant' ? 'restaurant' : category === 'cafe' ? 'cafe' : 'sight';
}

/** 식당·카페·볼거리 묶음이 모두 3곳 이상인지 */
export function isMixComplete(rows: { category?: string | null }[]): boolean {
  const have: Record<Group, number> = { restaurant: 0, cafe: 0, sight: 0 };
  for (const r of rows) have[groupOf(r.category)] += 1;
  return GROUPS.every((g) => have[g] >= GROUP_SIZE);
}

/** 무작위로 섞은 사본(Fisher–Yates) */
export function shuffled<T>(rows: T[], random: () => number = Math.random): T[] {
  const a = [...rows];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 쌓인 장소에서 묶음마다 **무작위로** 3곳씩 식당 → 카페 → 볼거리 순으로(모자란 묶음은 남은 곳 중 무작위로 채워 최대 9곳).
 * 비슷한 자리에서 열 때마다(기준 장소마다) 같은 가까운 곳만 나오지 않게 한다.
 */
export function pickBalanced<T extends { category?: string | null }>(rowsInput: T[], random: () => number = Math.random): T[] {
  const rows = shuffled(rowsInput, random);
  const max = GROUP_SIZE * GROUPS.length;
  const out: T[] = [];
  const picked = new Set<T>();
  for (const g of GROUPS) {
    let n = 0;
    for (const r of rows) {
      if (n >= GROUP_SIZE || out.length >= max) break;
      if (groupOf(r.category) !== g) continue;
      picked.add(r);
      out.push(r);
      n += 1;
    }
  }
  for (const r of rows) {
    if (out.length >= max) break;
    if (!picked.has(r)) {
      picked.add(r);
      out.push(r);
    }
  }
  return out;
}

/** 풀을 넉넉히 읽는다(RPC 상한 60, 0097) — 한 종류로만 몰려 있어도 묶음별로 고르고, 무작위로 고를 후보를 늘리려고 */
const POOL_READ = 60;

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

/** "주변" 추천 최대 거리(api/recommend.js MAX_DISTANCE_M과 같은 값) — AI가 엉뚱한 곳을 지어낸 것을 거르는 안전선 */
export const NEARBY_RADIUS_M = 1500;
/** 쌓인 장소를 '같은 곳'으로 보여 주는 범위(api/recommend.js POOL_RADIUS_M과 같은 값) */
export const NEARBY_POOL_RADIUS_M = 500;

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
 * 기준 좌표가 있으면: 500m 안 장소 풀(0050)에 식당 3·카페 3·볼거리 3이 있으면 그중 무작위로(AI 없음), 모자라면
 * /api/recommend가 AI로 모자란 만큼 더 받아 반경 안 것만 풀에 쌓은 뒤 돌려준다.
 * 좌표가 없으면(도시 기준): 1) 이름별 DB 캐시(0049) → 2) 없을 때만 /api/recommend.
 */
export async function fetchNearbyRecommendations(input: NearbyInput): Promise<ApiRecommendation[]> {
  if (input.lat != null && input.lng != null) {
    let poolRows: PoolRow[] = [];
    try {
      const { data, error } = await getSupabaseClient().rpc('get_nearby_ai_places', {
        p_lat: input.lat,
        p_lng: input.lng,
        p_radius_m: NEARBY_POOL_RADIUS_M,
        p_locale: aiLocale(input.locale),
        p_limit: POOL_READ,
      });
      if (!error && Array.isArray(data)) {
        poolRows = (data as PoolRow[]).filter((r) => r.place_id !== input.placeId && r.distance_m > 40);
        if (isMixComplete(poolRows)) return pickBalanced(poolRows).map(poolRowToRec);
      }
    } catch {
      // RPC 네트워크 오류 등 — 서버로 넘어간다
    }
    try {
      return await requestNearbyFromServer(input);
    } catch (err) {
      // 비로그인은 AI를 못 부르니, 쌓여 있는 곳이 있으면 그것만이라도 보여 준다
      if (err instanceof LoginRequiredError && poolRows.length > 0) return pickBalanced(poolRows).map(poolRowToRec);
      throw err;
    }
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
