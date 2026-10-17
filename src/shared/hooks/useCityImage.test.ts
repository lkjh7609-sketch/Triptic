import { describe, expect, it } from 'vitest';
import { destinationCover, matchCuratedCity } from './useCityImage';

describe('matchCuratedCity', () => {
  it('도시명을 단어 단위로 매칭한다', () => {
    expect(matchCuratedCity('Tokyo, Japan')).toContain('photo-1540959733332');
    expect(matchCuratedCity('일본 오사카부 오사카시')).toContain('photo-1528698827591');
  });

  it('부분 문자열로 엉뚱한 도시에 걸리지 않는다', () => {
    expect(matchCuratedCity('Manila, Philippines')).toBeNull();
    expect(matchCuratedCity('Atlanta, GA, USA')).toBeNull();
    expect(matchCuratedCity('Jerome, Idaho')).toBeNull();
  });
});

describe('destinationCover — 우리 도시 목록(DB) 사진', () => {
  const list = [
    { name: '호치민', slug: 'hochiminh', lat: 10.7769, lng: 106.7009, cover_url: 'db://hcm' },
    { name: '다낭', slug: 'danang', lat: 16.0544, lng: 108.2022, cover_url: 'db://dad' },
  ];
  it('좌표가 있으면 60km 안 가장 가까운 도시(화면 언어·저장 이름과 무관)', () => {
    expect(destinationCover('Ho Chi Minh City', { lat: 10.78, lng: 106.69 }, list)).toBe('db://hcm');
    expect(destinationCover('어딘가', { lat: 10.78, lng: 106.69 }, list)).toBe('db://hcm');
  });
  it('좌표가 없거나 멀면 이름·slug로, "호치민시"처럼 끝의 시도 같은 도시', () => {
    expect(destinationCover('호치민', undefined, list)).toBe('db://hcm');
    expect(destinationCover('호치민시', undefined, list)).toBe('db://hcm');
    expect(destinationCover('Da-Nang, Vietnam', undefined, list)).toBe('db://dad');
    expect(destinationCover('하노이', { lat: 21.03, lng: 105.85 }, list)).toBeNull();
    expect(destinationCover('호치민', undefined, undefined)).toBeNull();
  });
});
