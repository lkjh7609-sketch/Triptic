import type { TripRow } from '@/shared/api/tripService';
import {
  countryOfTrip,
  isWarned,
  type AlertLevel,
  type CityCoord,
  type CountryAlert,
} from '@/features/travelAlerts/alertInfo';

/** 아직 떠나지 않은 내 여행의 목적지 나라가 여행자제(2단계) 이상일 때의 알림 */
export interface AlertNotice {
  kind: 'alert';
  /** `여행id:alert:단계` — 단계가 올라가면 새 알림이 된다(같은 단계는 읽음·지움 기록이 그대로 이어진다) */
  id: string;
  tripId: string;
  title: string;
  countryCode: string;
  countryNameKo: string;
  level: AlertLevel;
}

/** 여행 시작일이 오늘 이후인 여행마다 하나 — 더 높은 단계가 먼저 */
export function buildAlertNotices(
  trips: TripRow[],
  coords: CityCoord[],
  alerts: Map<string, CountryAlert>,
  todayYmd: string,
): AlertNotice[] {
  const out: AlertNotice[] = [];
  for (const trip of trips) {
    if (trip.status === 'archived' || !trip.start_date || trip.start_date < todayYmd) continue;
    const code = countryOfTrip(trip, coords);
    const alert = code ? alerts.get(code) : undefined;
    if (!code || !isWarned(alert)) continue;
    out.push({
      kind: 'alert',
      id: `${trip.id}:alert:${alert.baseLevel}`,
      tripId: trip.id,
      title: trip.title,
      countryCode: code,
      countryNameKo: alert.nameKo,
      level: alert.baseLevel,
    });
  }
  return out.sort((a, b) => b.level - a.level || a.title.localeCompare(b.title));
}
