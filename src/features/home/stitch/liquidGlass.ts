/**
 * 리퀴드 글래스 — 홈 히어로 캡슐 탭 뒤의 사진이 유리 가장자리에서 휘어 보이게 하는 CSS + SVG 굴절.
 *
 * 원리: 캡슐 모양의 "변위 지도"(가장자리 쪽 픽셀이 안쪽을 가리키는 방향·세기를 색으로 적은 그림)를 그려 SVG feDisplacementMap에 넣고,
 * 그 필터를 `backdrop-filter: url(#…)`로 캡슐 뒤 화면에 건다. 가장자리에서만 크게 휘고 가운데는 거의 그대로다.
 * `backdrop-filter`에 SVG 필터를 거는 건 크롬 계열(크롬·엣지)만 되어서, 그 밖(사파리·파이어폭스·아이폰)은 굴절 없이 블러+테두리 유리로 둔다.
 */

export interface GlassMapOptions {
  /** 가장자리에서 안쪽으로 굴절이 일어나는 폭(px) */
  bezel: number;
  /** 가장 세게 휘는 픽셀 이동량(px) */
  maxOffset: number;
}

/**
 * 캡슐(양끝이 반원인 직사각형) 안의 한 점이 얼마나·어느 쪽으로 밀리는지. 좌표는 캡슐 중심 기준(px).
 * 가장자리(안쪽 거리 0)에서 최대, bezel 안쪽으로 갈수록 부드럽게 0이 되고, 그보다 안쪽·바깥은 0이다.
 * 방향은 중심 쪽(안쪽) — 캡슐 밖의 빈 곳을 가져오지 않게 한다.
 */
export function capsuleDisplacement(cx: number, cy: number, width: number, height: number, { bezel, maxOffset }: GlassMapOptions): { dx: number; dy: number } {
  const r = height / 2;
  const half = Math.max(width / 2 - r, 0);
  const qx = Math.min(Math.max(cx, -half), half);
  const vx = cx - qx;
  const vy = cy;
  const dist = Math.hypot(vx, vy);
  const inside = r - dist; // 경계까지의 거리(안쪽이면 양수)
  if (inside < 0 || inside >= bezel) return { dx: 0, dy: 0 };
  const t = inside / bezel; // 0(가장자리) ~ 1(안쪽)
  const strength = (1 - t) ** 2 * maxOffset;
  // 바깥 방향 단위 벡터(중심선 위의 점이면 위쪽)
  const nx = dist === 0 ? 0 : vx / dist;
  const ny = dist === 0 ? -1 : vy / dist;
  return { dx: -nx * strength, dy: -ny * strength };
}

/** 변위 지도를 PNG 데이터 주소로 그린다(R=가로, G=세로, 128이 "안 밀림"). 캔버스를 못 쓰면 null */
export function buildDisplacementMap(width: number, height: number, options: GlassMapOptions): string | null {
  const w = Math.round(width);
  const h = Math.round(height);
  if (w < 4 || h < 4) return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const image = ctx.createImageData(w, h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const { dx, dy } = capsuleDisplacement(x + 0.5 - w / 2, y + 0.5 - h / 2, w, h, options);
      const i = (y * w + x) * 4;
      image.data[i] = Math.round(128 + (dx / options.maxOffset) * 127);
      image.data[i + 1] = Math.round(128 + (dy / options.maxOffset) * 127);
      image.data[i + 2] = 128;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}

/** 크롬 계열만 backdrop-filter에 SVG 필터(url(#…))를 건다 — 사파리(아이폰 포함)·파이어폭스는 굴절 없이 대체 */
export function supportsBackdropSvgFilter(): boolean {
  if (typeof navigator === 'undefined' || typeof CSS === 'undefined') return false;
  const brands = (navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } }).userAgentData?.brands;
  const chromium = !!brands?.some((b) => /Chromium/i.test(b.brand));
  return chromium && CSS.supports('backdrop-filter', 'url(#x)');
}
