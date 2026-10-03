import { describe, expect, it } from 'vitest';
import {
  haversineKm,
  pickPlaceMatch,
  searchQueryFor,
  type PlaceCandidate,
} from './googleLinkMatch';

const c = (
  placeId: string,
  lat: number,
  lng: number,
  types: string[],
  name = placeId,
): PlaceCandidate => ({ placeId, name, lat, lng, types });
const tokyo = { lat: 35.6762, lng: 139.6503 };

describe('haversineKm', () => {
  it('서울-부산은 약 325km, 같은 점은 0', () => {
    expect(Math.round(haversineKm(37.5665, 126.978, 35.1796, 129.0756))).toBeGreaterThan(320);
    expect(Math.round(haversineKm(37.5665, 126.978, 35.1796, 129.0756))).toBeLessThan(335);
    expect(haversineKm(1, 2, 1, 2)).toBe(0);
  });
});

describe('pickPlaceMatch', () => {
  it('도시 단위 장소 중 가장 가까운 것을 확정한다(식당·호텔은 무시)', () => {
    const r = pickPlaceMatch(
      [
        c('hotel', 35.6763, 139.6504, ['lodging']),
        c('tokyo', 35.68, 139.69, ['locality', 'political']),
        c('far', 34.69, 135.5, ['locality']),
      ],
      tokyo,
    );
    expect(r.status).toBe('matched');
    expect(r.placeId).toBe('tokyo');
    expect(r.distanceKm).toBeLessThan(10);
  });

  it('도시 단위 결과가 기준 거리보다 멀면 확정하지 않고 far로 알린다', () => {
    const r = pickPlaceMatch([c('osaka', 34.69, 135.5, ['locality'])], tokyo);
    expect(r.status).toBe('far');
    expect(r.placeId).toBeNull();
    expect(r.candidate?.placeId).toBe('osaka');
    expect(r.distanceKm).toBeGreaterThan(300);
  });

  it('도시 단위 결과가 없으면 none', () => {
    expect(pickPlaceMatch([c('cafe', 35.676, 139.65, ['cafe'])], tokyo).status).toBe('none');
    expect(pickPlaceMatch([], tokyo).status).toBe('none');
  });

  it('섬 같은 곳은 기준 거리를 넓혀 확정할 수 있다', () => {
    const bali = { lat: -8.3405, lng: 115.092 };
    const r = pickPlaceMatch([c('bali', -8.65, 115.2, ['administrative_area_level_1'])], bali, 80);
    expect(r.status).toBe('matched');
  });
});

describe('searchQueryFor', () => {
  it('도시 + 나라, 이미 나라가 들어 있으면 그대로', () => {
    expect(searchQueryFor('Kyoto', 'Japan')).toBe('Kyoto, Japan');
    expect(searchQueryFor('Singapore', 'Singapore')).toBe('Singapore');
    expect(searchQueryFor('Hong Kong', '')).toBe('Hong Kong');
  });
});
