/**
 * 통계 탭의 도트(픽셀) 그림 — 아바타와 뱃지를 코드로 그린다(이미지 파일 없음). 둘 다 16×16 칸.
 * 같은 seed(사용자 ID)면 언제나 같은 모습이 나온다.
 */
export type Grid = (string | null)[][];

const SIZE = 16;

function blank(): Grid {
  return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => null as string | null));
}

function set(g: Grid, x: number, y: number, color: string) {
  if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) g[y]![x] = color;
}

function rect(g: Grid, x: number, y: number, w: number, h: number, color: string) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(g, x + i, y + j, color);
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

const SKIN = ['#F8D9C0', '#EFC29B', '#D9A074', '#A8714B', '#7A4A2E'];
const HAIR = ['#2B2118', '#4A3020', '#8C5A2B', '#C99A3A', '#B33A2E', '#3D3D4A', '#E8E1D4'];
const SHIRT = ['#2E4F4F', '#3F8F86', '#D97706', '#B08968', '#6B7FD7', '#C2577A', '#7C9A5A'];
const BG = ['#E1ECE9', '#FEF3C7', '#E8E4F5', '#FBE3E8', '#E3EFD9', '#E9E2D6'];
const INK = '#1C1917';

/** 도트 아바타(머리·머리카락·눈·입·옷). 머리 모양 5가지 × 피부 5 × 머리색 7 × 옷 7 × 배경 6에서 seed로 고른다 */
export function avatarGrid(seed: string): Grid {
  const r = rng(seed);
  const pick = <T,>(list: T[]) => list[Math.floor(r() * list.length)]!;
  const skin = pick(SKIN);
  const hair = pick(HAIR);
  const shirt = pick(SHIRT);
  const bg = pick(BG);
  const style = Math.floor(r() * 5);
  const eyes = Math.floor(r() * 3);
  const blush = r() < 0.5;

  const g = blank();
  rect(g, 0, 0, SIZE, SIZE, bg);
  // 옷(어깨)
  rect(g, 3, 12, 10, 4, shirt);
  rect(g, 2, 14, 12, 2, shirt);
  // 목
  rect(g, 7, 11, 2, 1, skin);
  // 머리
  rect(g, 4, 4, 8, 7, skin);
  rect(g, 5, 3, 6, 1, skin);
  rect(g, 5, 11, 6, 0, skin);
  // 머리카락
  switch (style) {
    case 0: // 짧은 머리
      rect(g, 4, 2, 8, 3, hair);
      rect(g, 3, 4, 1, 2, hair);
      rect(g, 12, 4, 1, 2, hair);
      break;
    case 1: // 긴 머리
      rect(g, 4, 2, 8, 3, hair);
      rect(g, 3, 4, 2, 8, hair);
      rect(g, 11, 4, 2, 8, hair);
      break;
    case 2: // 올림머리
      rect(g, 4, 3, 8, 2, hair);
      rect(g, 6, 0, 4, 3, hair);
      rect(g, 3, 4, 1, 2, hair);
      rect(g, 12, 4, 1, 2, hair);
      break;
    case 3: // 뾰족 머리
      rect(g, 4, 3, 8, 2, hair);
      set(g, 4, 2, hair);
      set(g, 7, 1, hair);
      set(g, 8, 1, hair);
      set(g, 11, 2, hair);
      set(g, 6, 2, hair);
      set(g, 9, 2, hair);
      break;
    default: // 모자
      rect(g, 3, 3, 10, 2, shirt);
      rect(g, 4, 1, 8, 2, shirt);
      rect(g, 3, 5, 1, 1, shirt);
      break;
  }
  // 눈
  const ey = 7;
  if (eyes === 0) {
    set(g, 6, ey, INK);
    set(g, 9, ey, INK);
  } else if (eyes === 1) {
    rect(g, 6, ey, 1, 2, INK);
    rect(g, 9, ey, 1, 2, INK);
  } else {
    rect(g, 5, ey, 2, 1, INK);
    rect(g, 9, ey, 2, 1, INK);
  }
  // 입
  rect(g, 7, 9, 2, 1, '#B4553F');
  if (blush) {
    set(g, 5, 9, '#F29B8B');
    set(g, 10, 9, '#F29B8B');
  }
  return g;
}

// ── 뱃지 ──
export type BadgeKind =
  | 'firstTrip' | 'firstAbroad' | 'firstCompanion' | 'oneLap'
  | 'countries3' | 'countries5' | 'countries10'
  | 'trips5' | 'trips10' | 'trips20'
  | 'days30' | 'days100';

const FONT: Record<string, string[]> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'], '1': ['.#.', '##.', '.#.', '.#.', '###'], '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '###', '..#', '###'], '5': ['###', '#..', '###', '..#', '###'],
};

const GLYPH: Record<string, string[]> = {
  firstTrip: ['#.......', '######..', '#######.', '######..', '#.......', '#.......', '#.......', '#.......'],
  firstAbroad: ['...#....', '...##...', '#..####.', '########', '#..####.', '...##...', '...#....', '........'],
  firstCompanion: ['.##..##.', '.##..##.', '........', '####.###', '####.###', '####.###', '........', '........'],
  oneLap: ['..####..', '.#.##.#.', '#..##..#', '########', '#..##..#', '#..##..#', '.#.##.#.', '..####..'],
};

const MINI: Record<string, string[]> = {
  countries: ['.###.', '#####', '.###.'],
  trips: ['..#..', '#####', '#####'],
  days: ['#.#.#', '.###.', '#.#.#'],
};

const TIER: Record<string, { rim: string; face: string; glyph: string }> = {
  special: { rim: '#A16207', face: '#FDE68A', glyph: '#78350F' },
  countries: { rim: '#2E4F4F', face: '#8FBFB4', glyph: '#12302F' },
  trips: { rim: '#B45309', face: '#FBBF24', glyph: '#78350F' },
  days: { rim: '#166534', face: '#86EFAC', glyph: '#14532D' },
};
const LOCKED = { rim: '#A8A29E', face: '#E7E5E4', glyph: '#A8A29E' };

function stamp(g: Grid, rows: string[], ox: number, oy: number, color: string) {
  rows.forEach((row, y) => [...row].forEach((c, x) => c === '#' && set(g, ox + x, oy + y, color)));
}

/** 도트 메달 — 동그란 틀 위에 그림 또는 숫자(숫자 아래에는 종류를 알리는 작은 그림) */
export function badgeGrid(kind: BadgeKind, locked: boolean): Grid {
  const m = /^(countries|trips|days)(\d+)$/.exec(kind);
  const tierKey = m ? m[1]! : 'special';
  const c = locked ? LOCKED : TIER[tierKey]!;
  const g = blank();
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d <= 7.6) g[y]![x] = c.rim;
      if (d <= 6.2) g[y]![x] = c.face;
    }
  }
  if (!locked) {
    // 윗부분 하이라이트
    [[4, 3], [5, 2], [6, 2], [3, 4]].forEach(([x, y]) => set(g, x!, y!, '#FFFFFF'));
  }
  if (m) {
    const digits = m[2]!;
    const width = digits.length * 3 + (digits.length - 1);
    let ox = Math.floor((SIZE - width) / 2);
    for (const ch of digits) {
      stamp(g, FONT[ch]!, ox, 4, c.glyph);
      ox += 4;
    }
    stamp(g, MINI[tierKey]!, 5, 10, c.glyph);
  } else {
    stamp(g, GLYPH[kind]!, 4, 4, c.glyph);
  }
  return g;
}
