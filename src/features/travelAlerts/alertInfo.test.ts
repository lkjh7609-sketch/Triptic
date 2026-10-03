import { describe, expect, it } from 'vitest';
import { buildCountryAlerts, countryOfTrip, isWarned, type TravelAlertRow } from './alertInfo';

function row(code: string, lvl: 1 | 2 | 3 | 4, base: boolean, remark = ''): TravelAlertRow {
  return {
    country_code: code,
    country_name_ko: code,
    country_name_en: code,
    alarm_lvl: lvl,
    region_scope: base ? 'all' : 'part',
    remark,
    is_base: base,
  };
}

describe('buildCountryAlerts', () => {
  it('기본 줄이 나라 단계가 되고, 그보다 높은 일부 지역만 안내로 남는다', () => {
    const map = buildCountryAlerts([
      row('PH', 4, false, '잠보앙가'),
      row('PH', 3, false, '팔라완 이남'),
      row('PH', 2, true, '나머지'),
      row('PH', 1, false, '보라카이'),
    ]);
    const ph = map.get('PH')!;
    expect(ph.baseLevel).toBe(2);
    expect(ph.partials.map((p) => [p.level, p.remark])).toEqual([
      [4, '잠보앙가'],
      [3, '팔라완 이남'],
    ]);
    expect(isWarned(ph)).toBe(true);
  });

  it('기본 줄이 없으면 기본 단계 없음(경고 안 띄움) — 일본은 후쿠시마만 3단계', () => {
    const jp = buildCountryAlerts([row('JP', 3, false, '후쿠시마')]).get('JP')!;
    expect(jp.baseLevel).toBe(0);
    expect(isWarned(jp)).toBe(false);
    expect(jp.partials).toHaveLength(1);
  });

  it('1단계(여행유의) 나라는 경고 대상이 아니다', () => {
    expect(isWarned(buildCountryAlerts([row('TH', 1, true)]).get('TH'))).toBe(false);
    expect(isWarned(undefined)).toBe(false);
  });
});

describe('countryOfTrip', () => {
  const coords = [
    { country_code: 'JP', lat: 35.68, lng: 139.69 },
    { country_code: 'KR', lat: 37.57, lng: 126.98 },
  ];
  it('가장 가까운 여행지의 나라를 짐작한다', () => {
    expect(countryOfTrip({ city_lat: 35.0, city_lng: 135.7 }, coords, 600)).toBe('JP');
    expect(countryOfTrip({ city_lat: 37.4, city_lng: 126.7 }, coords)).toBe('KR');
  });
  it('300km 안에 없거나 좌표가 없으면 모른다', () => {
    expect(countryOfTrip({ city_lat: -33.9, city_lng: 151.2 }, coords)).toBeNull();
    expect(countryOfTrip({ city_lat: null, city_lng: null }, coords)).toBeNull();
  });
});
