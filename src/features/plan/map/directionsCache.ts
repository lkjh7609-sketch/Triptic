/**
 * 구간 경로 캐시 (index.html에서 이식 — ADR-001)
 * 원본: index.html의 `let directionsCache = new Map()` + drawRoutesForViewMode 안의
 * cacheKey 생성/조회/저장 로직 (2026-09-20 기준 라인 3857, 7089~7124).
 *
 * 동일 세션 안에서 같은 구간(origin→destination)을 다시 조회하지 않기 위한
 * 클라이언트 메모리 캐시다. 좌표를 소수점 5자리로 반올림해 키를 만드는 방식과
 * OK/FAILED 두 상태를 저장하는 구조를 그대로 유지한다.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface DirectionsCacheHit {
  status: 'OK';
  result: google.maps.DirectionsResult;
  duration: string;
  distance: string;
}

export interface DirectionsCacheMiss {
  status: 'FAILED';
}

export type DirectionsCacheEntry = DirectionsCacheHit | DirectionsCacheMiss;

/** 원본과 동일한 키 생성 규칙: 좌표를 소수점 5자리(약 1m 정밀도)로 반올림 */
export function directionsCacheKey(origin: GeoPoint, destination: GeoPoint): string {
  return `${origin.lat.toFixed(5)},${origin.lng.toFixed(5)}->${destination.lat.toFixed(5)},${destination.lng.toFixed(5)}`;
}

export class DirectionsCache {
  private map = new Map<string, DirectionsCacheEntry>();

  get(origin: GeoPoint, destination: GeoPoint): DirectionsCacheEntry | undefined {
    return this.map.get(directionsCacheKey(origin, destination));
  }

  has(origin: GeoPoint, destination: GeoPoint): boolean {
    return this.map.has(directionsCacheKey(origin, destination));
  }

  setHit(
    origin: GeoPoint,
    destination: GeoPoint,
    result: google.maps.DirectionsResult,
    duration: string,
    distance: string,
  ): void {
    this.map.set(directionsCacheKey(origin, destination), {
      status: 'OK',
      result,
      duration,
      distance,
    });
  }

  setMiss(origin: GeoPoint, destination: GeoPoint): void {
    this.map.set(directionsCacheKey(origin, destination), { status: 'FAILED' });
  }

  clear(): void {
    this.map.clear();
  }
}
