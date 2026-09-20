import { describe, it, expect } from 'vitest';
import {
  haversineKm,
  computeDayZones,
  zoneCentroid,
  nearestZoneIndexForPoint,
  ZONE_DISTANCE_THRESHOLD_KM,
} from './geo';

describe('haversineKm', () => {
  it('같은 지점은 거리 0', () => {
    expect(haversineKm(37.5665, 126.978, 37.5665, 126.978)).toBeCloseTo(0, 5);
  });

  it('서울-도쿄 대권거리가 실제값(약 1160km)에 근접한다', () => {
    // 서울시청, 도쿄역
    const d = haversineKm(37.5665, 126.978, 35.6812, 139.7671);
    expect(d).toBeGreaterThan(1150);
    expect(d).toBeLessThan(1170);
  });
});

describe('computeDayZones', () => {
  it('좌표 없는 항목은 존 계산에서 건너뛴다', () => {
    const list = [{ lat: null, lng: null }, { lat: 35.6762, lng: 139.6503 }];
    const zones = computeDayZones(list);
    expect(zones).toEqual([{ indices: [1] }]);
  });

  it(`${ZONE_DISTANCE_THRESHOLD_KM}km 이내 항목은 같은 존으로 묶인다`, () => {
    // 도쿄역 근처 좌표들 (서로 수 km 이내)
    const list = [
      { lat: 35.6812, lng: 139.7671 },
      { lat: 35.6586, lng: 139.7454 }, // 도쿄타워, ~3km
      { lat: 35.6895, lng: 139.6917 }, // 신주쿠, ~9km
    ];
    const zones = computeDayZones(list);
    expect(zones).toEqual([{ indices: [0, 1, 2] }]);
  });

  it(`${ZONE_DISTANCE_THRESHOLD_KM}km를 초과하면 새 존을 시작한다`, () => {
    const list = [
      { lat: 35.6812, lng: 139.7671 }, // 도쿄역
      { lat: 34.6937, lng: 135.5023 }, // 오사카 — 약 400km
    ];
    const zones = computeDayZones(list);
    expect(zones).toEqual([{ indices: [0] }, { indices: [1] }]);
  });

  it('빈 리스트는 빈 존 배열을 반환한다', () => {
    expect(computeDayZones([])).toEqual([]);
  });
});

describe('zoneCentroid', () => {
  it('존에 속한 항목들의 평균 좌표를 반환한다', () => {
    const list = [
      { lat: 0, lng: 0 },
      { lat: 2, lng: 4 },
    ];
    const centroid = zoneCentroid({ indices: [0, 1] }, list);
    expect(centroid).toEqual({ lat: 1, lng: 2 });
  });
});

describe('nearestZoneIndexForPoint', () => {
  it('point에서 가장 가까운 존의 인덱스를 반환한다', () => {
    const list = [
      { lat: 35.6812, lng: 139.7671 }, // 도쿄역
      { lat: 34.6937, lng: 135.5023 }, // 오사카
    ];
    const zones = computeDayZones(list); // 서로 멀어서 존 2개
    // 도쿄역에 가까운 지점
    const nearTokyo = { lat: 35.68, lng: 139.76 };
    expect(nearestZoneIndexForPoint(zones, list, nearTokyo)).toBe(0);
    // 오사카에 가까운 지점
    const nearOsaka = { lat: 34.7, lng: 135.5 };
    expect(nearestZoneIndexForPoint(zones, list, nearOsaka)).toBe(1);
  });
});
