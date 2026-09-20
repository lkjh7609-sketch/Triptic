import { describe, it, expect } from 'vitest';
import { gridKey } from './gridKey';

describe('gridKey', () => {
  it('좌표를 1.1km 격자(소수점 2자리)로 반올림한다', () => {
    expect(gridKey(35.676234, 139.650311)).toBe('35.68,139.65');
    expect(gridKey(35.681, 139.653)).toBe('35.68,139.65'); // 같은 키
  });

  it('음수 좌표도 동일하게 반올림한다', () => {
    expect(gridKey(-33.8688, 151.2093)).toBe('-33.87,151.21');
  });
});
