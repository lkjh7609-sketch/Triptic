/**
 * 통계 탭의 도트 캐릭터 — 전신 아바타를 코드로 그린다(이미지 파일 없음). 32×48칸의 촘촘한 도트.
 * 같은 seed(사용자 ID)면 언제나 같은 모습이 나온다.
 */
export type Grid = (string | null)[][];

export const AVATAR_W = 32;
export const AVATAR_H = 48;

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

/** 문자열 → 32비트 해시(FNV-1a) */
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

const SKIN = ['#FFE0CC', '#F9CFAE', '#E9B48C', '#C98E63', '#8F5E3E'];
const HAIR = ['#2F2420', '#5B3A27', '#9A6636', '#E0B35A', '#D4543D', '#4A4A5C', '#F1E7D6', '#F59DB5'];
const SHIRT = ['#3F8F86', '#F59E0B', '#6B7FD7', '#EC6F8F', '#7FB069', '#2E4F4F', '#FF8A5C'];
const PANTS = ['#3D4B6B', '#5C5043', '#2E4F4F', '#7A6A9A', '#3B3B46'];
const PACK = ['#D97706', '#E55B5B', '#3F8F86', '#6B7FD7', '#8A5CF6'];
const OUTLINE = '#4A3428';
const SHADOW = '#00000022';

/**
 * 전신 도트 캐릭터 — 큰 머리·작은 몸의 귀여운 비율에 배낭을 멨다(여행 앱이라서).
 * 머리 6종(단발·긴 머리·양 갈래·삐죽·여행 모자·곱슬) × 피부 5 × 머리색 8 × 옷 7 × 바지 5 × 배낭 5 × 눈 3.
 * 그림이 끝나면 실루엣 둘레에 짙은 갈색 윤곽선을 둘러 스티커처럼 또렷하게 만든다.
 */
export function avatarGrid(seed: string): Grid {
  const r = rng(seed);
  const pick = <T,>(list: T[]) => list[Math.floor(r() * list.length)]!;
  const skin = pick(SKIN);
  const hair = pick(HAIR);
  const shirt = pick(SHIRT);
  const pants = pick(PANTS);
  const pack = pick(PACK);
  const style = Math.floor(r() * 6);
  const eyeKind = Math.floor(r() * 3);
  const hairDark = shade(hair, -0.22);
  const hairLight = shade(hair, 0.28);
  const skinDark = shade(skin, -0.12);

  const g = blank();
  const CX = 16;

  // ── 그림자(바닥)
  ellipse(g, CX, 46, 9, 1.6, SHADOW);

  // ── 배낭(몸 뒤로 양옆에 살짝 보이게)
  rect(g, CX - 9, 27, 4, 9, pack);
  rect(g, CX + 5, 27, 4, 9, pack);
  rect(g, CX - 9, 27, 4, 1, shade(pack, 0.25));
  rect(g, CX + 5, 27, 4, 1, shade(pack, 0.25));

  // ── 다리 + 신발
  rect(g, CX - 5, 36, 4, 6, pants);
  rect(g, CX + 1, 36, 4, 6, pants);
  rect(g, CX - 5, 36, 1, 6, shade(pants, 0.15));
  rect(g, CX + 1, 36, 1, 6, shade(pants, 0.15));
  rect(g, CX - 6, 42, 6, 3, '#F4F1EA');
  rect(g, CX, 42, 6, 3, '#F4F1EA');
  rect(g, CX - 6, 44, 6, 1, shade(shirt, -0.1));
  rect(g, CX, 44, 6, 1, shade(shirt, -0.1));

  // ── 몸통(옷) + 가슴끈
  rect(g, CX - 6, 26, 12, 11, shirt);
  rect(g, CX - 6, 26, 12, 2, shade(shirt, 0.2));
  rect(g, CX - 6, 35, 12, 2, shade(shirt, -0.12));
  rect(g, CX - 4, 27, 1, 8, shade(pack, -0.05));
  rect(g, CX + 3, 27, 1, 8, shade(pack, -0.05));
  rect(g, CX - 1, 26, 2, 2, skinDark); // 목 아래 옷깃 틈
  // ── 팔 + 손
  rect(g, CX - 9, 28, 3, 7, shirt);
  rect(g, CX + 6, 28, 3, 7, shirt);
  rect(g, CX - 9, 35, 3, 2, skin);
  rect(g, CX + 6, 35, 3, 2, skin);

  // ── 머리카락(뒤쪽)
  if (style === 1) {
    ellipse(g, CX, 17, 11, 11, hairDark);
    rect(g, CX - 11, 17, 22, 11, hairDark);
  } else if (style === 2) {
    ellipse(g, CX - 11, 17, 3.2, 3.2, hair); // 양 갈래 뭉치
    ellipse(g, CX + 11, 17, 3.2, 3.2, hair);
    rect(g, CX - 12, 19, 3, 7, hair);
    rect(g, CX + 10, 19, 3, 7, hair);
  } else if (style === 5) {
    ellipse(g, CX, 13, 12.5, 11, hair); // 곱슬 볼륨
  }

  // ── 얼굴
  ellipse(g, CX, 16, 10, 9, skin);
  ellipse(g, CX, 22, 8, 3.5, skin); // 턱
  rect(g, CX - 2, 24, 4, 2, skinDark); // 목

  // ── 앞머리·머리 윗부분
  const top = (_x: number, y: number) => y <= 12;
  switch (style) {
    case 0: // 단발 + 옆으로 쓸어 넘긴 앞머리
      ellipse(g, CX, 14, 11, 10, hair, (x, y) => y <= 12 || (Math.abs(x - CX) >= 9 && y <= 17));
      for (let i = 0; i < 9; i++) rect(g, CX - 9 + i, 12, 1, 2 + Math.floor((i * 3) / 8), hair);
      rect(g, CX - 11, 14, 2, 6, hair);
      rect(g, CX + 9, 14, 2, 6, hair);
      break;
    case 1: // 긴 머리 + 일자 앞머리
      ellipse(g, CX, 13, 11, 9.5, hair, top);
      rect(g, CX - 9, 12, 18, 3, hair);
      rect(g, CX - 11, 12, 2, 14, hair);
      rect(g, CX + 9, 12, 2, 14, hair);
      break;
    case 2: // 양 갈래
      ellipse(g, CX, 13, 10.5, 9, hair, top);
      rect(g, CX - 9, 12, 8, 2, hair);
      rect(g, CX + 1, 12, 8, 3, hair);
      break;
    case 3: // 삐죽 머리
      ellipse(g, CX, 13, 10.5, 8.5, hair, top);
      [-8, -4, 0, 4, 8].forEach((dx, i) => rect(g, CX + dx - 1, 3 - (i % 2), 3, 5, hair));
      rect(g, CX - 9, 12, 18, 2, hair);
      break;
    case 4: { // 여행 모자(챙이 있는 캡)
      const cap = shirt === '#2E4F4F' ? '#D97706' : shade(shirt, -0.05);
      ellipse(g, CX, 12, 11, 8, cap, top);
      rect(g, CX - 11, 11, 22, 3, shade(cap, -0.15));
      rect(g, CX - 3, 13, 14, 2, shade(cap, -0.15));
      set(g, CX, 4, hairLight);
      rect(g, CX - 1, 3, 3, 2, '#FFFFFF');
      break;
    }
    default: // 곱슬
      ellipse(g, CX, 12, 11, 8, hair, top);
      [-7, -3, 1, 5].forEach((dx) => ellipse(g, CX + dx + 1, 13, 2.2, 2, hair));
  }
  if (style !== 4) {
    // 머리카락 윗면 하이라이트
    rect(g, CX - 5, 6, 4, 1, hairLight);
    rect(g, CX - 7, 7, 2, 1, hairLight);
  }

  // ── 눈(크고 반짝이게) · 볼터치 · 입
  const eyeY = 16;
  const eyes = (x: number) => {
    if (eyeKind === 0) {
      rect(g, x, eyeY, 3, 4, '#2A1F1B');
      set(g, x + 1, eyeY, '#FFFFFF');
      set(g, x + 1, eyeY + 1, '#FFFFFF');
    } else if (eyeKind === 1) {
      rect(g, x, eyeY + 1, 3, 3, '#2A1F1B');
      set(g, x + 2, eyeY + 1, '#FFFFFF');
      set(g, x, eyeY + 3, '#6B7FD7');
    } else {
      // 웃는 눈(^)
      set(g, x, eyeY + 3, '#2A1F1B');
      set(g, x + 1, eyeY + 2, '#2A1F1B');
      set(g, x + 2, eyeY + 3, '#2A1F1B');
    }
  };
  eyes(CX - 6);
  eyes(CX + 3);
  rect(g, CX - 9, 20, 3, 2, '#F6A5A0');
  rect(g, CX + 6, 20, 3, 2, '#F6A5A0');
  rect(g, CX - 2, 21, 4, 1, '#B4553F');
  set(g, CX - 3, 20, '#B4553F');
  set(g, CX + 2, 20, '#B4553F');

  // ── 실루엣 윤곽선(그림자 제외)
  const filled = (x: number, y: number) => y >= 0 && y < AVATAR_H && x >= 0 && x < AVATAR_W && g[y]![x] != null && g[y]![x] !== SHADOW;
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
