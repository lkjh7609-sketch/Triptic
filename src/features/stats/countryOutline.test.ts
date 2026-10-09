import { describe, expect, it } from 'vitest';
import { lonScale, mainShape } from './countryOutline';

describe('lonScale', () => {
  // 지도: 높이 394, 위도 84(위)~-58(아래) → 위도 0은 y≈233
  it('적도 근처는 줄이지 않는다', () => {
    expect(lonScale({ minX: 0, minY: 232, maxX: 10, maxY: 234 }, 394, 84, -58)).toBeCloseTo(1, 1);
  });
  it('위도 60도 근처는 약 절반으로 줄인다', () => {
    const y60 = ((84 - 60) / 142) * 394;
    expect(lonScale({ minX: 0, minY: y60 - 1, maxX: 10, maxY: y60 + 1 }, 394, 84, -58)).toBeCloseTo(0.5, 1);
  });
  it('극지방에서도 0.2 아래로 내려가지 않는다', () => {
    expect(lonScale({ minX: 0, minY: 0, maxX: 10, maxY: 0 }, 394, 90, -58)).toBe(0.2);
  });
});

describe('mainShape', () => {
  it('경로가 없으면 null', () => {
    expect(mainShape(undefined)).toBeNull();
    expect(mainShape('')).toBeNull();
  });

  it('땅이 하나면 그대로', () => {
    const s = mainShape('M0 0L10 0L10 10L0 10Z');
    expect(s?.box).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 10 });
  });

  it('가장 큰 땅 근처의 땅은 남긴다', () => {
    const s = mainShape('M0 0L100 0L100 100L0 100ZM110 0L120 0L120 10L110 10Z');
    expect(s?.box.maxX).toBe(120);
  });

  it('멀리 떨어진 땅(알래스카·하와이 같은)은 뺀다', () => {
    const s = mainShape('M0 0L100 0L100 100L0 100ZM600 0L620 0L620 20L600 20Z');
    expect(s?.box).toEqual({ minX: 0, minY: 0, maxX: 100, maxY: 100 });
    expect(s?.d).not.toContain('600');
  });

  it('작은 땅이 앞에 있어도 가장 큰 땅을 기준으로 삼는다', () => {
    const s = mainShape('M500 0L505 0L505 5L500 5ZM0 0L100 0L100 100L0 100Z');
    expect(s?.box).toEqual({ minX: 0, minY: 0, maxX: 100, maxY: 100 });
  });
});
