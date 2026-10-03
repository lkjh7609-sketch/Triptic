import type { TripRow } from '@/shared/api/tripService';

/** travel_alerts 표의 한 줄(0082) */
export interface TravelAlertRow {
  country_code: string;
  country_name_ko: string;
  country_name_en: string;
  alarm_lvl: 1 | 2 | 3 | 4;
  region_scope: 'all' | 'part';
  remark: string;
  is_base: boolean;
}

export type AlertLevel = 1 | 2 | 3 | 4;

export interface CountryAlert {
  code: string;
  nameKo: string;
  nameEn: string;
  /** 도시에 적용하는 기본 단계 — 그 나라의 '나머지 지역' 줄. 없으면 0 */
  baseLevel: 0 | AlertLevel;
  /** 기본 단계보다 높은 일부 지역(높은 단계 먼저) */
  partials: { level: AlertLevel; remark: string }[];
}

/** 경고를 띄우는 가장 낮은 단계 — 여행자제(2단계)부터 */
export const WARN_LEVEL = 2;

/** 줄 목록 → 나라별 경보. 경보가 없는 나라는 들어 있지 않다 */
export function buildCountryAlerts(rows: TravelAlertRow[]): Map<string, CountryAlert> {
  const map = new Map<string, CountryAlert>();
  for (const row of rows) {
    let entry = map.get(row.country_code);
    if (!entry) {
      entry = {
        code: row.country_code,
        nameKo: row.country_name_ko,
        nameEn: row.country_name_en,
        baseLevel: 0,
        partials: [],
      };
      map.set(row.country_code, entry);
    }
    if (row.is_base) entry.baseLevel = Math.max(entry.baseLevel, row.alarm_lvl) as AlertLevel;
    else entry.partials.push({ level: row.alarm_lvl, remark: row.remark });
  }
  for (const entry of map.values()) {
    entry.partials = entry.partials
      .filter((p) => p.level > entry.baseLevel)
      .sort((a, b) => b.level - a.level);
  }
  return map;
}

/** 경고(팝업·띠·종)를 띄울 나라인가 */
export function isWarned(
  alert: CountryAlert | undefined,
): alert is CountryAlert & { baseLevel: AlertLevel } {
  return !!alert && alert.baseLevel >= WARN_LEVEL;
}

export interface CityCoord {
  country_code: string;
  lat: number;
  lng: number;
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 여행 좌표에서 가장 가까운 우리 여행지의 나라 코드 — 여행에는 나라 코드가 따로 없어서 이렇게 짐작한다(300km 안에 없으면 모름) */
export function countryOfTrip(
  trip: Pick<TripRow, 'city_lat' | 'city_lng'>,
  coords: CityCoord[],
  maxKm = 300,
): string | null {
  if (trip.city_lat == null || trip.city_lng == null) return null;
  let best: { code: string; km: number } | null = null;
  for (const c of coords) {
    const km = haversineKm(trip.city_lat, trip.city_lng, c.lat, c.lng);
    if (km <= maxKm && (!best || km < best.km)) best = { code: c.country_code, km };
  }
  return best?.code ?? null;
}
