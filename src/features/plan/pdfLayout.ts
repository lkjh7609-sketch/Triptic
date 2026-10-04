/**
 * PDF 일정표 배치 계산 — 그리기(pdfExport.ts, jsPDF)와 떨어진 순수 함수라 테스트할 수 있다.
 *  · 표지의 일차별 도시 줄(같은 도시가 이어지면 '도쿄 1–3일차'로 묶는다)
 *  · 예약 요약의 숙소 묶음(같은 숙소가 이어지는 밤 → 체크인~체크아웃)
 *  · 하루 동선 지도: 위경도 → 지도 칸 좌표(등장방형 + cos(위도)), 이름표 자리(겹치지 않게), 축척 막대
 *  · 하루 한 쪽 안에 들어가도록 타임라인 줄 높이·글자 크기
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** 0,0이나 범위 밖 좌표는 지도에 못 놓는다 */
export function hasCoord(p: { lat?: number | null; lng?: number | null }): p is LatLng {
  return (
    typeof p.lat === 'number' &&
    typeof p.lng === 'number' &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180 &&
    !(p.lat === 0 && p.lng === 0)
  );
}

// ── 표지: 일차별 도시 ───────────────────────────────────────────────

export interface CityRun {
  city: string;
  from: number;
  to: number;
}

/** 일차마다의 도시 → 이어지는 같은 도시를 한 덩어리로(1–3일차 도쿄, 4일차 교토 …) */
export function cityRuns(cityOfDay: (day: number) => string, totalDays: number): CityRun[] {
  const runs: CityRun[] = [];
  for (let d = 1; d <= totalDays; d += 1) {
    const city = cityOfDay(d).trim();
    const last = runs.at(-1);
    if (last && last.city === city) last.to = d;
    else runs.push({ city, from: d, to: d });
  }
  return runs;
}

// ── 표지: 숙소 묶음 ─────────────────────────────────────────────────

export interface HotelStay {
  name: string;
  address?: string;
  /** 체크인하는 일차(그날 밤 묵는다) */
  fromDay: number;
  /** 체크아웃하는 일차(마지막 밤의 다음 날) */
  toDay: number;
  nights: number;
}

/** 일차별 숙소(그날 밤) → 같은 숙소가 이어지는 밤을 한 번의 숙박으로 */
export function hotelStays(hotels: Record<number, { name: string; address?: string } | undefined>, totalDays: number): HotelStay[] {
  const stays: HotelStay[] = [];
  for (let d = 1; d <= totalDays; d += 1) {
    const h = hotels[d];
    const name = h?.name?.trim();
    if (!name) continue;
    const last = stays.at(-1);
    if (last && last.name === name && last.toDay === d) {
      last.toDay = d + 1;
      last.nights += 1;
    } else stays.push({ name, address: h?.address, fromDay: d, toDay: d + 1, nights: 1 });
  }
  return stays;
}

// ── 지도: 투영 ─────────────────────────────────────────────────────

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const EARTH_KM_PER_DEG = 111.32;

export interface Projection {
  /** 위경도 → 지도 칸 안의 mm 좌표 */
  toXY: (p: LatLng) => { x: number; y: number };
  /** 지도에서 1km가 몇 mm인가(축척 막대) */
  mmPerKm: number;
}

/**
 * 점들을 지도 칸에 맞춘다. 경도는 cos(평균 위도)를 곱해 동서·남북 거리 비율을 맞추고, 가로세로 중 더 빡빡한 쪽에 맞춰 키운다(비율 유지).
 * 점이 하나거나 아주 가까우면 최소 폭(minSpanKm)으로 — 핀 하나가 칸을 다 차지하지 않게.
 */
export function project(points: LatLng[], box: Box, pad: { x: number; y: number }, minSpanKm = 1.5): Projection {
  const lat0 = points.length ? points.reduce((s, p) => s + p.lat, 0) / points.length : 0;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const xs = points.map((p) => p.lng * k * EARTH_KM_PER_DEG);
  const ys = points.map((p) => p.lat * EARTH_KM_PER_DEG);
  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  if (!points.length) minX = maxX = minY = maxY = 0;
  const spanX = Math.max(maxX - minX, minSpanKm);
  const spanY = Math.max(maxY - minY, minSpanKm);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const innerW = box.w - pad.x * 2;
  const innerH = box.h - pad.y * 2;
  const mmPerKm = Math.min(innerW / spanX, innerH / spanY);
  return {
    mmPerKm,
    toXY: (p) => ({
      x: box.x + box.w / 2 + (p.lng * k * EARTH_KM_PER_DEG - cx) * mmPerKm,
      y: box.y + box.h / 2 - (p.lat * EARTH_KM_PER_DEG - cy) * mmPerKm,
    }),
  };
}

/**
 * 하루 동선에서 혼자 멀리 떨어진 점(공항·다른 도시) — 지도에서 뺀다(타임라인에는 남는다).
 * 중앙값에서 cutoffKm보다 멀거나, 다른 점들의 흩어진 정도(중앙값 거리)의 rel배·floorKm 중 큰 값보다 멀면 뺀다.
 * (하네다처럼 15km 떨어진 한 곳 때문에 신주쿠의 나머지가 한 점에 뭉치지 않게)
 */
export function nearCluster<T extends LatLng>(points: T[], cutoffKm = 40, rel = 5, floorKm = 6): T[] {
  if (points.length <= 2) return points;
  const med = (vals: number[]) => {
    const s = [...vals].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  const mLat = med(points.map((p) => p.lat));
  const mLng = med(points.map((p) => p.lng));
  const k = Math.cos((mLat * Math.PI) / 180);
  const dist = points.map((p) => Math.hypot((p.lat - mLat) * EARTH_KM_PER_DEG, (p.lng - mLng) * k * EARTH_KM_PER_DEG));
  const limit = Math.min(cutoffKm, Math.max(floorKm, rel * med(dist)));
  return points.filter((_, i) => dist[i] <= limit);
}

/** 거의 같은 자리의 핀은 작은 나선으로 비켜 놓는다(mm) */
export function spreadOverlaps(points: { x: number; y: number }[], minGap = 5): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const p of points) {
    let q = { ...p };
    for (let i = 1; out.some((o) => Math.hypot(o.x - q.x, o.y - q.y) < minGap) && i < 24; i += 1) {
      const a = i * 2.4;
      const r = minGap * (0.6 + i * 0.18);
      q = { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r };
    }
    out.push(q);
  }
  return out;
}

// ── 지도: 이름표 자리 ───────────────────────────────────────────────

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  /** placeLabels: 아무것과도 겹치지 않는 자리를 찾았는가 */
  clear?: boolean;
}

function overlaps(a: Rect, b: Rect, gap = 1): boolean {
  return a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
}

function clampInto(r: Rect, frame: Box): Rect {
  return {
    ...r,
    x: Math.min(Math.max(r.x, frame.x + 1), frame.x + frame.w - r.w - 1),
    y: Math.min(Math.max(r.y, frame.y + 1), frame.y + frame.h - r.h - 1),
  };
}

/**
 * 핀마다 이름표(w×h) 자리를 고른다 — 오른쪽 → 왼쪽 → 위 → 아래 → 대각선 → 조금 더 멀리 순으로, 이미 놓인 이름표·핀과 겹치지 않는 첫 자리.
 * 다 겹치면 겹침이 가장 적은 자리. 핀 머리(pinR) 둘레도 피한다. 결과는 지도 칸 안으로 잘린다.
 */
export function placeLabels(pins: { x: number; y: number }[], sizes: { w: number; h: number }[], frame: Box, pinR = 3.4): Rect[] {
  const pinRects: Rect[] = pins.map((p) => ({ x: p.x - pinR, y: p.y - pinR * 2.4, w: pinR * 2, h: pinR * 2.6 }));
  const placed: Rect[] = [];
  pins.forEach((p, i) => {
    const { w, h } = sizes[i];
    const g = pinR + 2.5;
    const top = p.y - pinR * 1.4;
    const candidates: Rect[] = [];
    for (const far of [0, 9, 18]) {
      candidates.push(
        { x: p.x + g + far, y: top - h / 2, w, h },
        { x: p.x - g - w - far, y: top - h / 2, w, h },
        { x: p.x - w / 2, y: top - pinR * 1.6 - h - far, w, h },
        { x: p.x - w / 2, y: p.y + 2.5 + far, w, h },
        { x: p.x + g + far, y: top - h - pinR - far / 2, w, h },
        { x: p.x - g - w - far, y: top - h - pinR - far / 2, w, h },
        { x: p.x + g + far, y: p.y + 1 + far / 2, w, h },
        { x: p.x - g - w - far, y: p.y + 1 + far / 2, w, h },
      );
    }
    let best: Rect | null = null;
    let bestScore = Infinity;
    let bestHits = Infinity;
    for (const c0 of candidates) {
      const c = clampInto(c0, frame);
      const hits =
        placed.filter((r) => overlaps(c, r)).length * 3 +
        pinRects.filter((r, j) => j !== i && overlaps(c, r, 0.5)).length * 2 +
        (overlaps(c, pinRects[i], 0) ? 2 : 0);
      const dist = Math.hypot(c.x + c.w / 2 - p.x, c.y + c.h / 2 - p.y) / 100;
      const score = hits + dist;
      if (score < bestScore) {
        bestScore = score;
        bestHits = hits;
        best = c;
      }
      if (hits === 0) break;
    }
    placed.push({ ...best!, clear: bestHits === 0 });
  });
  return placed;
}

/** 축척 막대 길이 — 지도 폭의 15~25%에 들어가는 보기 좋은 거리(100m·200m·500m·1km·2km·5km…) */
export function niceScale(mmPerKm: number, mapW: number): { km: number; mm: number } {
  const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200];
  const target = mapW * 0.2;
  let best = steps[0];
  for (const s of steps) if (Math.abs(s * mmPerKm - target) < Math.abs(best * mmPerKm - target)) best = s;
  return { km: best, mm: best * mmPerKm };
}

// ── 하루 한 쪽: 타임라인 ────────────────────────────────────────────

export interface RowBudget {
  rowH: number;
  fontSize: number;
  /** 다 못 넣으면 몇 줄만 그리고 나머지는 '+n곳 더' */
  shown: number;
}

/** 남은 높이(mm)에 줄 n개를 넣는 줄 높이·글자 크기. 가장 작게 해도 넘치면 앞에서부터 shown개만 */
export function rowBudget(n: number, availableMm: number, maxRowH = 9.5, minRowH = 5.6): RowBudget {
  if (n <= 0) return { rowH: maxRowH, fontSize: 9, shown: 0 };
  const rowH = Math.min(maxRowH, Math.max(minRowH, availableMm / n));
  const fits = Math.floor(availableMm / rowH + 1e-6);
  const shown = fits >= n ? n : Math.max(0, fits - 1); // 마지막 한 줄은 '+n곳 더'
  const fontSize = Math.max(6.6, Math.min(9, rowH * 0.95));
  return { rowH, fontSize, shown };
}

/** 한 줄에 안 들어가면 말줄임(폭 재기는 그리는 쪽이 준다) */
export function ellipsize(text: string, fits: (s: string) => boolean): string {
  if (fits(text)) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (fits(`${text.slice(0, mid)}…`)) lo = mid;
    else hi = mid - 1;
  }
  return lo > 0 ? `${text.slice(0, lo).trimEnd()}…` : '';
}
