import { describe, expect, it } from 'vitest';
import { matchCuratedCity } from './useCityImage';

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
