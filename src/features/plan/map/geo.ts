/**
 * 지도·경로 핵심 로직 (index.html에서 이식 — ADR-001 "로직 그대로 이식")
 * 원본: index.html haversineKm/computeDayZones/zoneCentroid/nearestZoneIndexForPoint
 * (2026-09-20 기준 라인 6846~6886)
 *
 * 전역 변수(plannerData[day] 등) 의존을 인자로 바꾼 것 외에 알고리즘은 원본과
 * 동일하다 — 20km 임계값, 대권거리 계산식, 존 분리 규칙을 한 글자도 바꾸지 않았다.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

/** 좌표가 아직 없을 수 있는 항목 (원본 코드의 `item.lat == null` 체크와 동일한 느슨함) */
interface MaybeGeoPoint {
  lat?: number | null;
  lng?: number | null;
}

/** 하루 안에서 지리적으로 떨어진 항목 묶음. 원본의 zones.push({ indices: [idx] }) 구조를 유지 */
export interface DayZone {
  indices: number[];
}

/** 존 분리 임계값(km). 원본 ZONE_DISTANCE_THRESHOLD_KM */
export const ZONE_DISTANCE_THRESHOLD_KM = 20;

/** 대권거리(km). 원본 haversineKm과 동일한 공식 */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * 하루의 항목 리스트를 순서대로 훑으며, 직전 항목과의 거리가 임계값을 넘으면
 * 새 존을 시작한다 (원본 computeDayZones). day 인자 대신 그 날의 list를 직접 받는다
 * (plannerData[day] 전역 접근 제거 — 알고리즘은 동일).
 */
export function computeDayZones<T extends MaybeGeoPoint>(list: T[]): DayZone[] {
  const zones: DayZone[] = [];
  list.forEach((item, idx) => {
    if (!item || item.lat == null || item.lng == null) return;
    if (zones.length === 0) {
      zones.push({ indices: [idx] });
      return;
    }
    const lastZone = zones[zones.length - 1];
    const lastItem = list[lastZone.indices[lastZone.indices.length - 1]];
    const dist = haversineKm(lastItem.lat!, lastItem.lng!, item.lat, item.lng);
    if (dist > ZONE_DISTANCE_THRESHOLD_KM) {
      zones.push({ indices: [idx] });
    } else {
      lastZone.indices.push(idx);
    }
  });
  return zones;
}

/** 존에 속한 항목들의 평균 좌표 (원본 zoneCentroid) */
export function zoneCentroid<T extends MaybeGeoPoint>(zone: DayZone, list: T[]): GeoPoint {
  const pts = zone.indices.map((i) => list[i]);
  return {
    lat: pts.reduce((s, p) => s + (p.lat ?? 0), 0) / pts.length,
    lng: pts.reduce((s, p) => s + (p.lng ?? 0), 0) / pts.length,
  };
}

/** point에 가장 가까운 존의 인덱스 (원본 nearestZoneIndexForPoint) */
export function nearestZoneIndexForPoint<T extends MaybeGeoPoint>(
  zones: DayZone[],
  list: T[],
  point: GeoPoint,
): number {
  let best = 0;
  let bestDist = Infinity;
  zones.forEach((zone, idx) => {
    const c = zoneCentroid(zone, list);
    const d = haversineKm(c.lat, c.lng, point.lat, point.lng);
    if (d < bestDist) {
      bestDist = d;
      best = idx;
    }
  });
  return best;
}
