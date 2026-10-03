/** 여행지 ↔ 구글 지도 장소 매칭 판단(순수 함수) — 관리자 'Google 연동' 화면이 쓴다 */

export interface PlaceCandidate {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  types: string[];
}

export interface MatchResult {
  status: 'matched' | 'far' | 'none';
  placeId: string | null;
  candidate: PlaceCandidate | null;
  distanceKm: number | null;
}

/** 두 좌표 사이 거리(km) */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r;
  const dLng = (lng2 - lng1) * r;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

/** 가까운 것을 믿는 거리(km) — 큰 도시·섬(발리·하와이·피지)은 중심점이 멀 수 있어 넉넉히 */
export const MATCH_MAX_KM = 60;

/** 지역·행정구역 같은 '도시 단위' 장소 종류 — 식당·호텔 같은 것이 잡히는 걸 막는다 */
const PLACE_TYPES = new Set([
  'locality',
  'administrative_area_level_1',
  'administrative_area_level_2',
  'administrative_area_level_3',
  'political',
  'sublocality',
  'colloquial_area',
  'natural_feature',
  'archipelago',
  'country',
]);

/**
 * 검색 결과 중 우리 도시 좌표에 가장 가까운 '도시 단위 장소'를 고른다. 기준 거리 안이면 확정(matched),
 * 도시 단위 결과는 있지만 멀면 사람이 확인해야 하는 far, 아예 없으면 none.
 */
export function pickPlaceMatch(
  candidates: readonly PlaceCandidate[],
  center: { lat: number; lng: number },
  maxKm = MATCH_MAX_KM,
): MatchResult {
  const scored = candidates
    .filter((c) => c.types.some((t) => PLACE_TYPES.has(t)))
    .map((c) => ({ c, d: haversineKm(center.lat, center.lng, c.lat, c.lng) }))
    .sort((a, b) => a.d - b.d);
  const best = scored[0];
  if (!best) return { status: 'none', placeId: null, candidate: null, distanceKm: null };
  if (best.d <= maxKm)
    return {
      status: 'matched',
      placeId: best.c.placeId,
      candidate: best.c,
      distanceKm: Math.round(best.d),
    };
  return { status: 'far', placeId: null, candidate: best.c, distanceKm: Math.round(best.d) };
}

/** 검색어 — 영어 도시 이름 + 나라(영어) */
export function searchQueryFor(cityEn: string, countryEn: string): string {
  return countryEn && !cityEn.toLowerCase().includes(countryEn.toLowerCase())
    ? `${cityEn}, ${countryEn}`
    : cityEn;
}
