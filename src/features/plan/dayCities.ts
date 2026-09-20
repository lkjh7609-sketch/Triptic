/**
 * 일차별 활동 도시 (index.html에서 이식 — ADR-001)
 * 원본: index.html getDayCity (2026-09-20 기준 라인 3828~3837).
 */
import type { DayCitiesData, DayCityInfo } from './types.ts';

/** 그 날짜에 별도로 지정된 도시가 있으면 그것을, 없으면 여행 전체 도시를 반환한다 */
export function getDayCity(
  day: number,
  dayCities: DayCitiesData,
  tripCity: { name: string | null; lat: number | null; lng: number | null },
): DayCityInfo {
  const override = dayCities[day];
  if (override && override.name) return override;
  return { name: tripCity.name ?? '', lat: tripCity.lat, lng: tripCity.lng };
}
