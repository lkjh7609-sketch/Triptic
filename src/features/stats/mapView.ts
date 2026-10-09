/**
 * 세계 지도 보기 영역 계산 — 순수 함수만(화면·DOM 없음).
 * 지도 좌표(0~1000 × 0~394)에서 "가운데 + 폭"으로 보는 영역을 나타낸다. 높이는 폭 ÷ 화면 가로세로비.
 */

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface MapView {
  cx: number;
  cy: number;
  w: number;
}

export const WORLD_W = 1000;
export const WORLD_H = 394;
/** 가장 많이 확대했을 때 보이는 폭(세계 폭의 1/12) */
export const MIN_VIEW_W = WORLD_W / 12;

/** 경로 문자열("M x y L x y … Z", 절대좌표만)의 경계 상자. 점이 없으면 null */
export function pathBBox(d: string): BBox | null {
  const nums = d.match(/-?\d+(?:\.\d+)?/g);
  if (!nums || nums.length < 2) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = Number(nums[i]);
    const y = Number(nums[i + 1]);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

export function unionBBox(boxes: (BBox | null)[]): BBox | null {
  const list = boxes.filter((b): b is BBox => b !== null);
  if (list.length === 0) return null;
  return {
    minX: Math.min(...list.map((b) => b.minX)),
    minY: Math.min(...list.map((b) => b.minY)),
    maxX: Math.max(...list.map((b) => b.maxX)),
    maxY: Math.max(...list.map((b) => b.maxY)),
  };
}

export function viewHeight(view: MapView, aspect: number): number {
  return view.w / aspect;
}

/** 폭·가운데를 지도 안으로 되돌린다. 보이는 영역이 지도보다 크면 그 방향은 가운데에 고정 */
export function clampView(view: MapView, aspect: number): MapView {
  const w = Math.min(WORLD_W, Math.max(MIN_VIEW_W, view.w));
  const h = w / aspect;
  const cx = w >= WORLD_W ? WORLD_W / 2 : Math.min(WORLD_W - w / 2, Math.max(w / 2, view.cx));
  const cy = h >= WORLD_H ? WORLD_H / 2 : Math.min(WORLD_H - h / 2, Math.max(h / 2, view.cy));
  return { cx, cy, w };
}

/** 세계 전체가 보이는 처음 모습 */
export function worldView(aspect: number): MapView {
  return clampView({ cx: WORLD_W / 2, cy: WORLD_H / 2, w: WORLD_W }, aspect);
}

/**
 * 경계 상자를 여백(비율)과 함께 감싸는 보기. 한 점만 있어도 너무 크게 확대되지 않게 minSpan(지도 좌표)을 둔다.
 * 상자가 없으면 세계 전체.
 */
export function fitView(box: BBox | null, aspect: number, pad = 0.25, minSpan = 120): MapView {
  if (!box) return worldView(aspect);
  const spanX = Math.max(minSpan, (box.maxX - box.minX) * (1 + pad * 2));
  const spanY = Math.max(minSpan / aspect, (box.maxY - box.minY) * (1 + pad * 2));
  const w = Math.max(spanX, spanY * aspect);
  return clampView({ cx: (box.minX + box.maxX) / 2, cy: (box.minY + box.maxY) / 2, w }, aspect);
}

/** 지도 좌표 (ax, ay) 지점을 화면에서 제자리에 둔 채 factor배 확대(1보다 크면 확대) */
export function zoomAt(view: MapView, factor: number, ax: number, ay: number, aspect: number): MapView {
  const h = view.w / aspect;
  const fx = (ax - (view.cx - view.w / 2)) / view.w;
  const fy = (ay - (view.cy - h / 2)) / h;
  const nextW = Math.min(WORLD_W, Math.max(MIN_VIEW_W, view.w / factor));
  const nextH = nextW / aspect;
  return clampView({ cx: ax - fx * nextW + nextW / 2, cy: ay - fy * nextH + nextH / 2, w: nextW }, aspect);
}

/** 지도 좌표 단위로 옮긴다 */
export function panBy(view: MapView, dx: number, dy: number, aspect: number): MapView {
  return clampView({ ...view, cx: view.cx + dx, cy: view.cy + dy }, aspect);
}

/** 보이는 영역 → svg viewBox 문자열 */
export function viewBoxOf(view: MapView, aspect: number): string {
  const h = view.w / aspect;
  return `${round(view.cx - view.w / 2)} ${round(view.cy - h / 2)} ${round(view.w)} ${round(h)}`;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
