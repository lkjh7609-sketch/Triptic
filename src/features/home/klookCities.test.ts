import { describe, expect, it } from 'vitest';
import { nearestKlookCityId } from './klookCities';

describe('nearestKlookCityId', () => {
  it('여행 도시 좌표에서 가장 가까운 Klook 도시 번호', () => {
    expect(nearestKlookCityId(-33.87, 151.21)).toBe(68); // 시드니
    expect(nearestKlookCityId(34.7025, 135.4959)).toBe(29); // 오사카역
    expect(nearestKlookCityId(35.68, 139.76)).toBe(28); // 도쿄역
  });
  it('150km 안에 없으면 null(기본 도시로 대신)', () => {
    expect(nearestKlookCityId(0, -150)).toBeNull();
  });
});
