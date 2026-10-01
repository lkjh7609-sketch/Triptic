import { describe, expect, it } from 'vitest';
import { capsuleDisplacement } from './liquidGlass';

const OPTS = { bezel: 20, maxOffset: 20 };
// 폭 300 · 높이 60 캡슐(반지름 30)
const W = 300;
const H = 60;

describe('capsuleDisplacement', () => {
  it('가운데(가장자리에서 먼 곳)는 밀리지 않는다', () => {
    expect(capsuleDisplacement(0, 0, W, H, OPTS)).toEqual({ dx: 0, dy: 0 });
    expect(capsuleDisplacement(100, 0, W, H, OPTS)).toEqual({ dx: 0, dy: 0 });
  });

  it('캡슐 밖은 밀리지 않는다', () => {
    expect(capsuleDisplacement(0, 40, W, H, OPTS)).toEqual({ dx: 0, dy: 0 });
    expect(capsuleDisplacement(200, 0, W, H, OPTS)).toEqual({ dx: 0, dy: 0 });
  });

  it('위쪽 가장자리는 아래(안쪽)로, 아래쪽 가장자리는 위로 최대한 밀린다', () => {
    const top = capsuleDisplacement(0, -29.9, W, H, OPTS);
    expect(top.dx).toBeCloseTo(0, 5);
    expect(top.dy).toBeGreaterThan(19);
    const bottom = capsuleDisplacement(0, 29.9, W, H, OPTS);
    expect(bottom.dy).toBeLessThan(-19);
  });

  it('양 끝 반원에서는 중심 쪽(가로)으로 밀린다', () => {
    const right = capsuleDisplacement(149.9, 0, W, H, OPTS);
    expect(right.dx).toBeLessThan(-19);
    expect(Math.abs(right.dy)).toBeLessThan(1e-6);
    const left = capsuleDisplacement(-149.9, 0, W, H, OPTS);
    expect(left.dx).toBeGreaterThan(19);
  });

  it('가장자리에서 안쪽으로 갈수록 부드럽게 줄어든다', () => {
    const magnitudes = [-29, -25, -20, -15, -11].map((y) => Math.abs(capsuleDisplacement(0, y, W, H, OPTS).dy));
    for (let i = 1; i < magnitudes.length; i += 1) expect(magnitudes[i]).toBeLessThan(magnitudes[i - 1]);
  });
});
