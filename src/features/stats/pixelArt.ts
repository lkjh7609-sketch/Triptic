/**
 * 통계 탭의 도트 캐릭터 — 전신 아바타를 코드로 그린다(이미지 파일 없음). 36×52칸의 촘촘한 도트.
 * 큰 머리·작은 몸의 2등신 느낌, 눈은 작은 세로 막대, 입은 거의 없고 볼만 살짝 붉게 — 짙은 윤곽선으로 또렷하게.
 * 같은 seed(사용자 ID)면 언제나 같은 모습이 나온다.
 */
export type Grid = (string | null)[][];

export const AVATAR_W = 36;
export const AVATAR_H = 52;

function blank(w = AVATAR_W, h = AVATAR_H): Grid {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => null as string | null));
}

function set(g: Grid, x: number, y: number, color: string) {
  if (y >= 0 && y < g.length && x >= 0 && x < g[0]!.length) g[y]![x] = color;
}

function rect(g: Grid, x: number, y: number, w: number, h: number, color: string) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(g, x + i, y + j, color);
}

function ellipse(g: Grid, cx: number, cy: number, rx: number, ry: number, color: string, clip?: (x: number, y: number) => boolean) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1 && (!clip || clip(x, y))) set(g, x, y, color);
    }
  }
}

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: string): () => number {
  let a = hash(seed) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** #RRGGBB를 비율만큼 어둡게(음수)·밝게(양수) */
function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount)));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

const SKIN = ['#FBE0CF', '#F6CDB3', '#E8B48F', '#C98E63', '#8F5E3E'];
const HAIR = ['#4A3A33', '#2F2624', '#6B4A38', '#A87B4C', '#D9B067', '#B5483A', '#5B5B6E', '#E9E1D2', '#F4A6BC'];
const SUIT = ['#33363D', '#26324A', '#2E4F4F', '#5B4A3F'];
const DRESS = ['#D9365B', '#3F8F86', '#6B7FD7', '#F08A4B', '#8E6BBF', '#E5648A'];
const CASUAL = ['#F59E0B', '#3F8F86', '#EC6F8F', '#7FB069', '#6B7FD7', '#FF8A5C', '#E8E1D2'];
const PANTS = ['#3A4666', '#5C5043', '#33363D', '#7A6A9A', '#4C6B8A'];
const OUTLINE = '#2B2321';
const EYE = '#2A1F1B';
const BLUSH = '#F2A199';

type Outfit = 'suit' | 'dress' | 'hoodie' | 'tee';

/** 도트 캐릭터를 정하는 값 — 본인이 고른 값이 있으면 그것, 없으면 사용자 ID */
export function avatarSeedOf(userId: string, pixelSeed?: string | null): string {
  return pixelSeed || userId;
}

/** 설정의 '랜덤으로 바꾸기' — 겹치지 않는 새 값 */
export function randomAvatarSeed(): string {
  const bytes = new Uint32Array(2);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else bytes.forEach((_, i) => (bytes[i] = Math.floor(Math.random() * 4294967296)));
  return `r${bytes[0]!.toString(36)}${bytes[1]!.toString(36)}`;
}

export function avatarGrid(seed: string): Grid {
  const r = rng(seed);
  const pick = <T,>(list: T[]) => list[Math.floor(r() * list.length)]!;
  const skin = pick(SKIN);
  const hair = pick(HAIR);
  const outfit = pick<Outfit>(['suit', 'dress', 'hoodie', 'tee', 'hoodie', 'suit']);
  const accent = pick(CASUAL);
  const pants = pick(PANTS);
  const hairStyle = Math.floor(r() * 6);
  const smile = r() < 0.35;
  const accessory = r() < 0.3 ? (r() < 0.5 ? 'glasses' : 'clip') : 'none';
  const skinDark = shade(skin, -0.14);
  const hairLight = shade(hair, 0.22);
  const hairDark = shade(hair, -0.2);

  const g = blank();
  const CX = 18;

  // ── 몸(머리 아래) ────────────────────────────────────────────
  const torsoTop = 29;
  // 팔·손은 옷마다 소매 색이 달라서 옷 안에서 그린다
  if (outfit === 'dress') {
    const dress = pick(DRESS);
    // 소매 없는 윗부분 + A라인 치마
    rect(g, CX - 5, torsoTop, 10, 5, dress);
    rect(g, CX - 5, torsoTop, 10, 1, shade(dress, 0.2));
    for (let y = 0; y < 13; y++) {
      const half = 6 + Math.floor(y * 0.62);
      rect(g, CX - half, torsoTop + 5 + y, half * 2, 1, y % 4 === 3 ? shade(dress, -0.1) : dress);
    }
    rect(g, CX - 6, torsoTop + 4, 12, 1, shade(dress, -0.18)); // 허리선
    rect(g, CX - 9, torsoTop + 1, 2, 7, skin); // 맨팔
    rect(g, CX + 7, torsoTop + 1, 2, 7, skin);
    rect(g, CX - 3, 47, 2, 2, skin); // 발목
    rect(g, CX + 1, 47, 2, 2, skin);
    rect(g, CX - 4, 49, 3, 2, '#3A2E2A'); // 구두
    rect(g, CX + 1, 49, 3, 2, '#3A2E2A');
  } else {
    const jacket = outfit === 'suit' ? pick(SUIT) : accent;
    // 몸통 + 소매
    rect(g, CX - 7, torsoTop, 14, 11, jacket);
    rect(g, CX - 10, torsoTop + 1, 3, 9, jacket);
    rect(g, CX + 7, torsoTop + 1, 3, 9, jacket);
    rect(g, CX - 10, torsoTop + 10, 3, 2, skin); // 손
    rect(g, CX + 7, torsoTop + 10, 3, 2, skin);
    rect(g, CX - 7, torsoTop, 14, 1, shade(jacket, 0.18));
    rect(g, CX - 7, torsoTop + 9, 14, 2, shade(jacket, -0.14));
    // 다리
    const legColor = outfit === 'tee' ? shade(pants, 0.1) : pants;
    rect(g, CX - 6, torsoTop + 11, 5, 6, legColor);
    rect(g, CX + 1, torsoTop + 11, 5, 6, legColor);
    rect(g, CX - 6, torsoTop + 11, 1, 6, shade(legColor, 0.15));
    rect(g, CX + 1, torsoTop + 11, 1, 6, shade(legColor, 0.15));
    const shoe = outfit === 'suit' ? '#2B2321' : '#F4F1EA';
    rect(g, CX - 7, torsoTop + 17, 6, 3, shoe);
    rect(g, CX + 1, torsoTop + 17, 6, 3, shoe);
    rect(g, CX - 7, torsoTop + 19, 6, 1, shade(shoe, outfit === 'suit' ? 0.15 : -0.2));
    rect(g, CX + 1, torsoTop + 19, 6, 1, shade(shoe, outfit === 'suit' ? 0.15 : -0.2));
    if (outfit === 'suit') {
      // 흰 셔츠(V자) + 넥타이
      for (let i = 0; i < 6; i++) rect(g, CX - 3 + Math.floor(i / 2), torsoTop + i, 6 - Math.floor(i / 2) * 2, 1, '#FFFFFF');
      rect(g, CX, torsoTop + 1, 1, 6, pick(DRESS));
      rect(g, CX - 1, torsoTop, 3, 1, pick(DRESS));
      rect(g, CX - 5, torsoTop + 5, 1, 5, shade(jacket, 0.1)); // 옷깃선
      rect(g, CX + 4, torsoTop + 5, 1, 5, shade(jacket, 0.1));
    } else if (outfit === 'hoodie') {
      // 후드 고리 + 가운데 지퍼선 + 주머니
      ellipse(g, CX, torsoTop - 0.5, 6.5, 3, shade(jacket, 0.15));
      rect(g, CX, torsoTop + 3, 1, 8, shade(jacket, -0.25));
      rect(g, CX - 6, torsoTop + 7, 5, 1, shade(jacket, -0.22));
      rect(g, CX + 1, torsoTop + 7, 5, 1, shade(jacket, -0.22));
    } else {
      // 티셔츠: 목둘레 + 가슴 줄무늬
      rect(g, CX - 3, torsoTop, 6, 1, skinDark);
      rect(g, CX - 7, torsoTop + 4, 14, 1, shade(jacket, 0.3));
      rect(g, CX - 7, torsoTop + 6, 14, 1, shade(jacket, 0.3));
    }
  }

  // 목
  rect(g, CX - 2, 27, 4, 3, skinDark);

  // ── 머리 ───────────────────────────────────────────────────
  // 뒷머리(긴 머리·양 갈래·단발)
  if (hairStyle === 1) {
    ellipse(g, CX, 17, 13.2, 12.2, hairDark);
    rect(g, CX - 13, 17, 26, 10, hairDark);
  } else if (hairStyle === 3) {
    ellipse(g, CX - 14.5, 19, 3, 6, hair);
    ellipse(g, CX + 14.5, 19, 3, 6, hair);
    rect(g, CX - 16, 22, 3, 7, hairDark);
    rect(g, CX + 13, 22, 3, 7, hairDark);
  } else if (hairStyle === 5) {
    ellipse(g, CX, 16, 13.2, 12.2, hairDark);
    rect(g, CX - 13, 16, 26, 9, hairDark);
  }
  // 귀
  rect(g, CX - 14, 16, 2, 4, skin);
  rect(g, CX + 12, 16, 2, 4, skin);
  rect(g, CX - 14, 17, 1, 2, skinDark);
  rect(g, CX + 13, 17, 1, 2, skinDark);
  // 얼굴
  ellipse(g, CX, 15.5, 12.8, 11.8, skin);
  ellipse(g, CX, 22.5, 9.5, 4.5, skin);
  // 눈 — 작은 세로 막대, 입은 거의 없다
  const eyeKind = Math.floor(r() * 2);
  [CX - 8, CX + 6].forEach((x) => {
    rect(g, x, 16, 2, eyeKind === 0 ? 4 : 3, EYE);
    set(g, x + 1, 16, shade(EYE, 0.45));
  });
  // 볼
  rect(g, CX - 10, 21, 3, 2, BLUSH);
  rect(g, CX + 8, 21, 3, 2, BLUSH);
  if (smile) {
    set(g, CX - 1, 23, '#B4553F');
    set(g, CX, 24, '#B4553F');
    set(g, CX + 1, 23, '#B4553F');
  }
  // 머리카락(앞)
  const dxOf = (x: number) => x + 0.5 - CX;
  const fringe = (dx: number): number => {
    switch (hairStyle) {
      case 0: return 10 + Math.max(0, Math.min(1, (dx + 8) / 16)) * 5; // 옆으로 쓸어 넘김
      case 1: return 8 + Math.min(Math.abs(dx), 7) * 0.8; // 가운데 가르마
      case 2: return 10 + Math.abs(dx) * 0.18; // 올림머리(이마 시원하게)
      case 3: return 12; // 일자 앞머리
      case 4: return 10 + ((Math.floor(dx + 20) % 4) < 2 ? 1 : 3); // 삐죽
      default: return 12 + Math.abs(dx) * 0.1;
    }
  };
  const sideHair = hairStyle === 1 || hairStyle === 5 || hairStyle === 3;
  for (let y = 1; y < 27; y++) {
    for (let x = 0; x < AVATAR_W; x++) {
      const dx = dxOf(x);
      const ex = dx / 13.9;
      const ey = (y + 0.5 - 14.5) / 12.8;
      if (ex * ex + ey * ey > 1) continue;
      const topPart = y < fringe(dx);
      const sidePart = sideHair && Math.abs(dx) > 10.5 && y < 24;
      if (!topPart && !sidePart) continue;
      const streak = (x * 2 + y * 3) % 7 === 0 && y < fringe(dx) - 1;
      const edge = y >= fringe(dx) - 1.2 && topPart;
      set(g, x, y, edge ? hairDark : streak ? hairLight : hair);
    }
  }
  // 머리 모양 덤
  if (hairStyle === 2) {
    ellipse(g, CX, 3.5, 5.5, 4.5, hair); // 올림머리 똥머리
    rect(g, CX - 4, 2, 3, 1, hairLight);
    rect(g, CX - 5, 6, 10, 1, hairDark);
  } else if (hairStyle === 4) {
    [-9, -5, -1, 3, 7].forEach((dx, i) => {
      const h = 3 + (i % 3);
      rect(g, CX + dx, 4 - Math.floor(h / 2), 3, h + 2, i % 2 ? hair : hairLight);
    });
  }
  // 앞머리가 얼굴 윗선을 덮은 자리에 이마 그림자
  for (let x = CX - 9; x <= CX + 9; x++) {
    const fy = Math.floor(fringe(dxOf(x)));
    if (g[fy] && g[fy]![x] === skin) g[fy]![x] = skinDark;
  }
  // 소품
  if (accessory === 'glasses') {
    const frame = '#3A2E2A';
    rect(g, CX - 10, 15, 6, 1, frame);
    rect(g, CX - 10, 19, 6, 1, frame);
    rect(g, CX - 10, 15, 1, 5, frame);
    rect(g, CX - 5, 15, 1, 5, frame);
    rect(g, CX + 4, 15, 6, 1, frame);
    rect(g, CX + 4, 19, 6, 1, frame);
    rect(g, CX + 4, 15, 1, 5, frame);
    rect(g, CX + 9, 15, 1, 5, frame);
    rect(g, CX - 4, 16, 8, 1, frame);
  } else if (accessory === 'clip') {
    // 작은 꽃 핀(하얀 꽃잎 다섯 칸 + 분홍 가운데)
    [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => set(g, CX + 8 + dx!, 8 + dy!, '#FFFFFF'));
    set(g, CX + 8, 8, '#F2A199');
  }

  // ── 윤곽선 ─────────────────────────────────────────────────
  const filled = (x: number, y: number) => y >= 0 && y < AVATAR_H && x >= 0 && x < AVATAR_W && g[y]![x] != null;
  const out: [number, number][] = [];
  for (let y = 0; y < AVATAR_H; y++) {
    for (let x = 0; x < AVATAR_W; x++) {
      if (filled(x, y)) continue;
      if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) out.push([x, y]);
    }
  }
  for (const [x, y] of out) g[y]![x] = OUTLINE;
  return g;
}
