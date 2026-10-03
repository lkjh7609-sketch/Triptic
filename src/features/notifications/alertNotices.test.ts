import { describe, expect, it } from 'vitest';
import type { TripRow } from '@/shared/api/tripService';
import { buildCountryAlerts, type TravelAlertRow } from '@/features/travelAlerts/alertInfo';
import { buildAlertNotices } from './alertNotices';

function trip(
  id: string,
  start: string | null,
  lat: number | null,
  lng: number | null,
  over: Partial<TripRow> = {},
): TripRow {
  return {
    id,
    title: `여행 ${id}`,
    start_date: start,
    city_lat: lat,
    city_lng: lng,
    status: 'planning',
    ...over,
  } as TripRow;
}
function row(code: string, lvl: 1 | 2 | 3 | 4, base: boolean): TravelAlertRow {
  return {
    country_code: code,
    country_name_ko: code,
    country_name_en: code,
    alarm_lvl: lvl,
    region_scope: base ? 'all' : 'part',
    remark: '',
    is_base: base,
  };
}

const coords = [
  { country_code: 'AE', lat: 25.2, lng: 55.27 },
  { country_code: 'JP', lat: 35.68, lng: 139.69 },
  { country_code: 'TH', lat: 13.75, lng: 100.5 },
];
const alerts = buildCountryAlerts([row('AE', 3, true), row('JP', 3, false), row('TH', 1, true)]);
const today = '2026-10-04';

describe('buildAlertNotices', () => {
  it('아직 안 떠난 여행의 나라가 2단계 이상이면 알림이 하나 생기고, id에 단계가 들어간다', () => {
    const list = buildAlertNotices(
      [trip('dubai', '2026-11-01', 25.1, 55.2)],
      coords,
      alerts,
      today,
    );
    expect(list).toEqual([
      expect.objectContaining({
        id: 'dubai:alert:3',
        tripId: 'dubai',
        level: 3,
        countryCode: 'AE',
      }),
    ]);
  });

  it('기본 단계가 없거나 1단계인 나라, 이미 시작한 여행, 보관한 여행, 좌표 없는 여행은 알리지 않는다', () => {
    const list = buildAlertNotices(
      [
        trip('jp', '2026-11-01', 35.6, 139.7),
        trip('th', '2026-11-01', 13.7, 100.5),
        trip('started', '2026-10-01', 25.1, 55.2),
        trip('arch', '2026-11-01', 25.1, 55.2, { status: 'archived' }),
        trip('nocoord', '2026-11-01', null, null),
      ],
      coords,
      alerts,
      today,
    );
    expect(list).toEqual([]);
  });
});
