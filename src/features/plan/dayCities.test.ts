import { describe, it, expect } from 'vitest';
import { getDayCity } from './dayCities';

const tripCity = { name: 'Tokyo, Japan', lat: 35.6762, lng: 139.6503 };

describe('getDayCity', () => {
  it('일차별로 지정된 도시가 있으면 그것을 반환한다', () => {
    const dayCities = { 3: { name: 'Kyoto, Japan', lat: 35.0116, lng: 135.7681 } };
    expect(getDayCity(3, dayCities, tripCity)).toEqual(dayCities[3]);
  });

  it('지정된 도시가 없으면 여행 전체 도시를 반환한다', () => {
    expect(getDayCity(1, {}, tripCity)).toEqual(tripCity);
  });

  it('이름이 빈 문자열인 지정 항목은 무시하고 여행 전체 도시로 폴백한다', () => {
    const dayCities = { 2: { name: '', lat: null, lng: null } };
    expect(getDayCity(2, dayCities, tripCity)).toEqual(tripCity);
  });
});
