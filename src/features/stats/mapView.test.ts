import { describe, expect, it } from 'vitest';
import { MIN_VIEW_W, WORLD_H, WORLD_W, clampView, fitView, panBy, pathBBox, unionBBox, viewBoxOf, worldView, zoomAt } from './mapView';

const WIDE = WORLD_W / WORLD_H; // PC: 세계 전체가 딱 맞는 비율
const TALL = 4 / 5; // 모바일

describe('pathBBox / unionBBox', () => {
  it('절대좌표 경로의 경계 상자를 구한다', () => {
    expect(pathBBox('M10 20L30 5L25 40ZM100 100L110 90L105 120Z')).toEqual({ minX: 10, minY: 5, maxX: 110, maxY: 120 });
  });
  it('점이 없으면 null', () => {
    expect(pathBBox('')).toBeNull();
  });
  it('여러 상자를 합치고 null은 건너뛴다', () => {
    expect(unionBBox([{ minX: 0, minY: 0, maxX: 5, maxY: 5 }, null, { minX: 3, minY: -2, maxX: 9, maxY: 4 }])).toEqual({ minX: 0, minY: -2, maxX: 9, maxY: 5 });
    expect(unionBBox([null])).toBeNull();
  });
});

describe('worldView / clampView', () => {
  it('PC 비율에서는 세계 전체가 viewBox와 같다', () => {
    expect(viewBoxOf(worldView(WIDE), WIDE)).toBe(`0 0 ${WORLD_W} ${WORLD_H}`);
  });
  it('모바일 비율에서는 세로가 지도보다 커도 가운데에 둔다', () => {
    const v = worldView(TALL);
    expect(v).toEqual({ cx: WORLD_W / 2, cy: WORLD_H / 2, w: WORLD_W });
  });
  it('폭은 최소·최대 사이로 제한하고 가운데는 지도 밖으로 못 나간다', () => {
    expect(clampView({ cx: 0, cy: 0, w: 5 }, WIDE)).toEqual({ cx: MIN_VIEW_W / 2, cy: MIN_VIEW_W / WIDE / 2, w: MIN_VIEW_W });
    expect(clampView({ cx: 5000, cy: 5000, w: 100000 }, WIDE).w).toBe(WORLD_W);
  });
});

describe('fitView', () => {
  it('상자가 없으면 세계 전체', () => {
    expect(fitView(null, TALL)).toEqual(worldView(TALL));
  });
  it('한 점만 있어도 최소 폭 이상으로 확대하지 않는다', () => {
    const v = fitView({ minX: 800, minY: 120, maxX: 800, maxY: 120 }, TALL);
    expect(v.w).toBeGreaterThanOrEqual(120);
    expect(v.cx).toBeCloseTo(800);
  });
  it('상자를 여백과 함께 감싼다', () => {
    const box = { minX: 800, minY: 100, maxX: 900, maxY: 140 };
    const v = fitView(box, WIDE, 0.25, 10);
    const h = v.w / WIDE;
    expect(v.cx - v.w / 2).toBeLessThanOrEqual(box.minX);
    expect(v.cx + v.w / 2).toBeGreaterThanOrEqual(box.maxX);
    expect(v.cy - h / 2).toBeLessThanOrEqual(box.minY);
    expect(v.cy + h / 2).toBeGreaterThanOrEqual(box.maxY);
  });
  it('지도 가장자리 근처여도 지도 밖으로 나가지 않는다', () => {
    const v = fitView({ minX: 990, minY: 0, maxX: 1000, maxY: 10 }, WIDE, 0.25, 100);
    expect(v.cx + v.w / 2).toBeLessThanOrEqual(WORLD_W + 1e-9);
  });
});

describe('zoomAt / panBy', () => {
  it('확대해도 기준점이 화면 같은 자리에 남는다', () => {
    const v0 = worldView(WIDE);
    const ax = 700;
    const ay = 120;
    const fx0 = (ax - (v0.cx - v0.w / 2)) / v0.w;
    const v1 = zoomAt(v0, 3, ax, ay, WIDE);
    expect(v1.w).toBeCloseTo(WORLD_W / 3);
    const fx1 = (ax - (v1.cx - v1.w / 2)) / v1.w;
    expect(fx1).toBeCloseTo(fx0);
  });
  it('최대 확대·최소 축소를 넘지 않는다', () => {
    let v = worldView(WIDE);
    for (let i = 0; i < 20; i++) v = zoomAt(v, 2, 500, 200, WIDE);
    expect(v.w).toBeCloseTo(MIN_VIEW_W);
    v = zoomAt(v, 1 / 1000, 500, 200, WIDE);
    expect(v.w).toBe(WORLD_W);
  });
  it('이동은 지도 안에서 멈춘다', () => {
    const z = zoomAt(worldView(WIDE), 4, 500, 200, WIDE);
    const moved = panBy(z, 5000, 5000, WIDE);
    expect(moved.cx + moved.w / 2).toBeLessThanOrEqual(WORLD_W + 1e-9);
    expect(moved.cy + moved.w / WIDE / 2).toBeLessThanOrEqual(WORLD_H + 1e-9);
  });
});
