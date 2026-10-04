/* i18n-exempt-file: API가 주는 한국어 주차장 이름(평면도와 잇는 열쇠)을 담은 배치 데이터 — 화면 글자는 번역 키(label)로 그린다 */
/**
 * 공항 주차장 평면도 배치 — 각 공항 공식 주차 안내도(인천: airport.kr, 그 밖: airport.co.kr, 2026-10-04 확인)를 따라 그린 단순화 도식.
 * 좌표는 안내도 이미지 크기 그대로의 viewBox(인천 T1 1478×858, T2 1478×829, 한국공항공사 1180×640, 김해 755×555)라
 * 안내도와 겹쳐 보며 고칠 수 있다.
 *
 * 사용자 결정(2026-10-04):
 *  · 여객 주차장만 색칠한다. 화물·API에 없는 주차장(인천 P4 상주직원, 직원주차장 등)은 회색 배경(누를 수 없음)으로만.
 *  · API의 한 주차장이 안내도에서 여러 구역이면 한 덩어리로 묶는다(김해 P1=국내선 주차빌딩+옥외, P2=국제선 주차빌딩+옥외, 대구 주차장+주차빌딩).
 *  · 층으로 나뉜 주차장(인천 단기)과 인천 T2 장기주차타워 P1·P2는 건물 하나로 그리고, 누르면 층(칸) 스택으로 보여 준다.
 *  · 배치에 없는 새 주차장 이름이 API에 생기면 평면도 아래 '기타 주차장' 목록으로(hidden에 있는 화물은 계속 숨김).
 */

export type Shape =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; r?: number }
  | { kind: 'poly'; points: string }
  | { kind: 'path'; d: string };

/** 누르면 반응하는 주차장 묶음 — lots의 API 이름을 합쳐 남은 대수·혼잡도를 그린다 */
export interface LotGroup {
  id: string;
  /** airportPage.parking.lot.<label> */
  label: string;
  /** 묶음 안 주차장(API 이름)과 층·칸 이름(B1·1F·P1처럼 언어와 무관). 둘 이상이면 누를 때 스택으로 보여 준다 */
  parts: { lot: string; tag?: string }[];
  shapes: Shape[];
  /** 이름·남은 대수를 쓰는 자리(블록 가운데쯤) */
  labelAt: { x: number; y: number };
  /** 키가 낮은 블록(주차타워) — 이름과 숫자를 한 줄로 써서 블록 밖으로 넘치지 않게 */
  inline?: boolean;
}

/** 배경 도형(터미널·회색 주차장·건물) — 누를 수 없다 */
export interface ContextShape {
  shape: Shape;
  /** airportPage.parking.place.<label>, 없으면 글자 없음 */
  label?: string;
  labelAt?: { x: number; y: number; rotate?: number };
  tone: 'terminal' | 'muted';
}

export interface ParkingPlan {
  id: string;
  /** API의 공항 코드 */
  airport: string;
  /** 인천처럼 한 공항에 평면도가 둘이면 전환 버튼 이름(airportPage.parking.plan.<key>) */
  planLabel?: string;
  width: number;
  height: number;
  /** 길(옅은 선) — 위치 감만 준다 */
  roads: string[];
  context: ContextShape[];
  groups: LotGroup[];
  /** 방위 글자(안내도에 있는 것만) */
  compass?: { left: string; right: string };
  /** 이 평면도 공항의 API 이름 중 일부러 숨기는 것(화물) */
  hidden: string[];
}

const ICN_T1: ParkingPlan = {
  id: 'icn-t1',
  airport: 'ICN',
  planLabel: 't1',
  width: 1478,
  height: 858,
  roads: [
    'M300,750 L1300,750',
    'M330,600 C300,420 420,250 560,215',
    'M1300,720 C1180,420 1050,250 920,215',
    'M370,615 C700,640 900,640 1200,615',
    'M740,600 L740,800',
  ],
  context: [
    {
      tone: 'terminal',
      shape: { kind: 'path', d: 'M425,205 C560,95 920,95 1055,205 L1020,232 C900,140 580,140 460,232 Z' },
      label: 't1Terminal',
      labelAt: { x: 740, y: 120 },
    },
    { tone: 'muted', shape: { kind: 'rect', x: 390, y: 510, w: 325, h: 86, r: 40 }, label: 't1P4', labelAt: { x: 552, y: 553 } },
  ],
  groups: [
    {
      id: 'icn-t1-short',
      label: 't1Short',
      parts: [
        { lot: 'T1 단기주차장지상층', tag: '1F' },
        { lot: 'T1 단기주차장지하1층', tag: 'B1' },
        { lot: 'T1 단기주차장지하2층', tag: 'B2' },
        { lot: 'T1 단기주차장지하3층', tag: 'B3' },
      ],
      shapes: [{ kind: 'path', d: 'M552,212 C640,180 840,180 928,212 L900,298 L580,298 Z' }],
      labelAt: { x: 740, y: 250 },
    },
    {
      id: 'icn-t1-p2-tower',
      label: 't1P2Tower',
      parts: [{ lot: 'T1 장기 P2 주차타워' }],
      shapes: [{ kind: 'rect', x: 572, y: 335, w: 146, h: 50, r: 6 }],
      labelAt: { x: 645, y: 360 },
      inline: true,
    },
    {
      id: 'icn-t1-p2',
      label: 't1P2',
      parts: [{ lot: 'T1 장기 P2 주차장' }],
      shapes: [{ kind: 'poly', points: '392,482 392,452 452,412 488,382 488,335 568,335 568,389 718,389 718,483' }],
      labelAt: { x: 590, y: 438 },
    },
    {
      id: 'icn-t1-p1-tower',
      label: 't1P1Tower',
      parts: [{ lot: 'T1 장기 P1 주차타워' }],
      shapes: [{ kind: 'rect', x: 760, y: 335, w: 146, h: 50, r: 6 }],
      labelAt: { x: 833, y: 360 },
      inline: true,
    },
    {
      id: 'icn-t1-p1',
      label: 't1P1',
      parts: [{ lot: 'T1 장기 P1 주차장' }],
      shapes: [{ kind: 'poly', points: '760,389 910,389 910,335 992,335 992,400 1035,412 1088,452 1088,482 760,483' }],
      labelAt: { x: 900, y: 438 },
    },
    {
      id: 'icn-t1-p3',
      label: 't1P3',
      parts: [{ lot: 'T1 장기 P3 주차장' }],
      shapes: [{ kind: 'path', d: 'M763,512 L1046,512 C1072,512 1088,530 1088,554 C1088,578 1072,596 1046,596 L763,596 Z' }],
      labelAt: { x: 920, y: 554 },
    },
    {
      id: 'icn-t1-p5',
      label: 't1P5',
      parts: [{ lot: 'T1 P5 예약주차장' }],
      shapes: [{ kind: 'rect', x: 427, y: 645, w: 288, h: 82, r: 6 }],
      labelAt: { x: 571, y: 686 },
    },
  ],
  compass: { left: 'W', right: 'E' },
  hidden: [],
};

const ICN_T2: ParkingPlan = {
  id: 'icn-t2',
  airport: 'ICN',
  planLabel: 't2',
  width: 1478,
  height: 829,
  roads: ['M455,528 L1478,528', 'M710,528 L710,260 L1478,260', 'M710,528 L710,660 L1478,660', 'M1270,260 L1270,0'],
  context: [
    {
      tone: 'terminal',
      shape: {
        kind: 'path',
        d: 'M0,340 L110,348 C160,352 200,330 250,338 L400,345 L415,400 L380,412 C330,372 230,370 190,400 C140,440 140,620 190,660 C230,690 330,688 380,650 L415,662 L400,712 L250,720 C200,728 160,706 110,710 L0,718 Z',
      },
      label: 't2Terminal',
      labelAt: { x: 70, y: 529, rotate: -90 },
    },
  ],
  groups: [
    {
      id: 'icn-t2-short',
      label: 't2Short',
      parts: [
        { lot: 'T2 단기주차장지상4층', tag: '4F' },
        { lot: 'T2 단기주차장지상3층', tag: '3F' },
        { lot: 'T2 단기주차장지상2층', tag: '2F' },
        { lot: 'T2 단기주차장지상1층', tag: '1F' },
        { lot: 'T2 단기주차장지하M층', tag: 'M' },
      ],
      shapes: [{ kind: 'path', d: 'M458,505 C420,465 380,385 268,385 C175,385 158,455 158,530 C158,605 175,676 268,676 C380,676 420,595 458,555 Z' }],
      labelAt: { x: 300, y: 530 },
    },
    {
      id: 'icn-t2-long',
      label: 't2Long',
      parts: [{ lot: 'T2 장기 주차장' }],
      shapes: [{ kind: 'rect', x: 722, y: 274, w: 410, h: 168, r: 8 }],
      labelAt: { x: 927, y: 358 },
    },
    {
      id: 'icn-t2-towers',
      label: 't2Towers',
      parts: [
        { lot: 'T2 P1 장기주차타워', tag: 'P1' },
        { lot: 'T2 P2 장기주차타워', tag: 'P2' },
      ],
      shapes: [{ kind: 'rect', x: 1140, y: 285, w: 112, h: 148, r: 8 }],
      labelAt: { x: 1196, y: 359 },
    },
    {
      id: 'icn-t2-reserved',
      label: 't2Reserved',
      parts: [{ lot: 'T2 예약 주차장' }],
      shapes: [{ kind: 'rect', x: 1282, y: 12, w: 184, h: 228, r: 8 }],
      labelAt: { x: 1374, y: 126 },
    },
  ],
  compass: { left: 'S', right: 'N' },
  hidden: [],
};

const GMP: ParkingPlan = {
  id: 'gmp',
  airport: 'GMP',
  width: 1180,
  height: 640,
  roads: [
    'M0,610 L470,560 L1180,560',
    'M700,0 L455,640',
    'M680,110 L1000,560',
    'M150,520 C300,410 500,300 640,230',
    'M760,330 C690,260 640,200 690,195',
  ],
  context: [
    { tone: 'terminal', shape: { kind: 'poly', points: '262,298 362,236 404,306 302,368' }, label: 'domestic', labelAt: { x: 333, y: 302, rotate: -31 } },
    { tone: 'terminal', shape: { kind: 'poly', points: '155,374 430,220 440,238 166,392' } },
    { tone: 'terminal', shape: { kind: 'poly', points: '772,130 800,114 980,410 950,426' } },
    { tone: 'terminal', shape: { kind: 'poly', points: '800,240 850,210 905,300 855,330' }, label: 'international', labelAt: { x: 852, y: 270, rotate: 59 } },
    { tone: 'muted', shape: { kind: 'poly', points: '470,180 512,40 575,58 532,198' }, label: 'kac', labelAt: { x: 522, y: 120, rotate: -73 } },
    { tone: 'muted', shape: { kind: 'path', d: 'M600,410 m-48,0 a48,48 0 1,0 96,0 a48,48 0 1,0 -96,0' }, label: 'lotteMall', labelAt: { x: 600, y: 410 } },
    { tone: 'muted', shape: { kind: 'poly', points: '0,470 100,412 125,455 25,513' }, label: 'cargo', labelAt: { x: 62, y: 463, rotate: -30 } },
    { tone: 'muted', shape: { kind: 'poly', points: '22,540 122,482 138,508 38,566' } },
  ],
  groups: [
    {
      id: 'gmp-d1',
      label: 'gmpD1',
      parts: [{ lot: '국내선 제1주차장' }],
      shapes: [{ kind: 'path', d: 'M300,462 C292,430 320,412 362,392 L460,342 C488,330 498,350 486,374 C470,404 450,438 430,462 C412,482 380,494 340,496 C316,497 304,482 300,462 Z' }],
      labelAt: { x: 395, y: 432 },
    },
    {
      id: 'gmp-d2',
      label: 'gmpD2',
      parts: [{ lot: '국내선 제2주차장' }],
      shapes: [{ kind: 'rect', x: 240, y: 522, w: 92, h: 46, r: 8 }],
      labelAt: { x: 286, y: 545 },
    },
    {
      id: 'gmp-intl-bldg',
      label: 'gmpIntlBldg',
      parts: [{ lot: '국제선 주차빌딩' }],
      shapes: [{ kind: 'poly', points: '706,108 732,94 792,198 766,212' }],
      labelAt: { x: 749, y: 153 },
    },
    {
      id: 'gmp-intl-under',
      label: 'gmpIntlUnder',
      parts: [{ lot: '국제선 지하' }],
      shapes: [{ kind: 'poly', points: '714,370 736,348 762,380 766,410 740,416' }],
      labelAt: { x: 740, y: 385 },
    },
  ],
  hidden: ['화물청사'],
};

const TAE: ParkingPlan = {
  id: 'tae',
  airport: 'TAE',
  width: 1180,
  height: 640,
  roads: [
    'M0,545 L1180,545',
    'M305,0 L305,640',
    'M440,265 L940,265 C990,265 985,500 940,500 L440,500 C330,500 330,265 440,265',
    'M770,640 L1180,400',
  ],
  context: [
    { tone: 'terminal', shape: { kind: 'poly', points: '415,118 615,118 615,190 692,190 692,224 415,224' }, label: 'terminal', labelAt: { x: 515, y: 172 } },
    { tone: 'terminal', shape: { kind: 'poly', points: '700,170 846,170 846,222 815,222 815,234 752,234 752,222 700,222' } },
  ],
  groups: [
    {
      id: 'tae-main',
      label: 'taeLot',
      parts: [{ lot: '여객주차장' }],
      shapes: [
        { kind: 'poly', points: '415,296 696,296 696,402 575,402 575,456 415,456' },
        { kind: 'rect', x: 714, y: 296, w: 104, h: 160, r: 8 },
        { kind: 'rect', x: 840, y: 296, w: 38, h: 160, r: 8 },
      ],
      labelAt: { x: 556, y: 360 },
    },
  ],
  hidden: ['화물주차장'],
};

const PUS: ParkingPlan = {
  id: 'pus',
  airport: 'PUS',
  width: 755,
  height: 555,
  roads: [
    'M110,380 C80,300 120,170 220,110 C300,70 470,60 540,110 C580,140 600,300 640,450',
    'M180,375 L580,375',
    'M300,130 L300,375',
    'M610,440 L755,420',
  ],
  context: [
    { tone: 'terminal', shape: { kind: 'poly', points: '38,150 128,40 168,68 78,178' }, label: 'domestic', labelAt: { x: 103, y: 110, rotate: -52 } },
    { tone: 'terminal', shape: { kind: 'rect', x: 318, y: 0, w: 126, h: 90, r: 4 }, label: 'international', labelAt: { x: 381, y: 52 } },
    { tone: 'muted', shape: { kind: 'rect', x: 626, y: 378, w: 116, h: 38, r: 6 }, label: 'cargo', labelAt: { x: 684, y: 397 } },
  ],
  groups: [
    {
      id: 'pus-p1',
      label: 'pusP1',
      parts: [{ lot: 'P1 여객주차장' }],
      shapes: [
        { kind: 'poly', points: '135,300 192,214 214,228 156,316' },
        { kind: 'rect', x: 230, y: 202, w: 58, h: 142, r: 4 },
      ],
      labelAt: { x: 259, y: 272 },
    },
    {
      id: 'pus-p2',
      label: 'pusP2',
      parts: [{ lot: 'P2 여객주차장' }],
      shapes: [
        { kind: 'rect', x: 333, y: 192, w: 38, h: 110, r: 4 },
        { kind: 'poly', points: '384,212 445,212 445,240 487,240 487,320 384,320' },
      ],
      labelAt: { x: 435, y: 280 },
    },
    {
      id: 'pus-p3',
      label: 'pusP3',
      parts: [{ lot: 'P3 여객(화물)' }],
      shapes: [{ kind: 'poly', points: '650,470 736,442 746,482 664,512' }],
      labelAt: { x: 698, y: 477 },
    },
  ],
  hidden: [],
};

const CJU: ParkingPlan = {
  id: 'cju',
  airport: 'CJU',
  width: 1180,
  height: 640,
  roads: [
    'M200,640 L1180,350',
    'M735,640 L735,285 C735,240 690,140 720,60 C760,20 860,90 870,180',
    'M300,470 C290,350 380,230 600,170 C660,150 700,250 730,290',
    'M735,420 L1080,470 L1085,370',
  ],
  context: [
    { tone: 'terminal', shape: { kind: 'poly', points: '240,252 412,100 552,100 552,150 420,152 262,272' }, label: 'terminal', labelAt: { x: 440, y: 132, rotate: -30 } },
    { tone: 'muted', shape: { kind: 'rect', x: 562, y: 104, w: 84, h: 30, r: 6 } },
    { tone: 'muted', shape: { kind: 'poly', points: '330,384 414,338 438,372 354,418' }, label: 'rentalCar', labelAt: { x: 384, y: 378, rotate: -29 } },
    { tone: 'muted', shape: { kind: 'poly', points: '138,462 238,404 270,446 170,504' }, label: 'tower', labelAt: { x: 204, y: 454, rotate: -30 } },
    { tone: 'muted', shape: { kind: 'poly', points: '846,156 1018,252 996,300 826,206' }, label: 'cargo', labelAt: { x: 922, y: 228, rotate: 29 } },
  ],
  groups: [
    {
      id: 'cju-p1',
      label: 'cjuP1',
      parts: [{ lot: 'P1주차장' }],
      shapes: [
        { kind: 'poly', points: '380,438 455,300 520,268 556,300 640,268 662,296 650,320 560,380 395,468' },
        { kind: 'poly', points: '550,262 612,236 626,262 562,288' },
      ],
      labelAt: { x: 520, y: 345 },
    },
    {
      id: 'cju-p2',
      label: 'cjuP2',
      parts: [{ lot: 'P2장기주차장' }],
      shapes: [{ kind: 'poly', points: '176,520 278,462 312,522 212,578' }],
      labelAt: { x: 244, y: 520 },
    },
  ],
  hidden: ['화물주차장'],
};

/** 공항 탭 → 평면도(인천은 T1·T2 둘, 전환 버튼) */
export const PARKING_PLANS: Record<string, ParkingPlan[]> = {
  icn: [ICN_T1, ICN_T2],
  gmp: [GMP],
  tae: [TAE],
  pus: [PUS],
  cju: [CJU],
};

/** 그 공항의 평면도들이 다루는 API 이름(묶음 + 숨김) — 여기에 없는 이름은 '기타 주차장' 목록으로 */
export function knownLotNames(plans: ParkingPlan[]): Set<string> {
  const names = new Set<string>();
  for (const plan of plans) {
    for (const g of plan.groups) for (const p of g.parts) names.add(p.lot);
    for (const h of plan.hidden) names.add(h);
  }
  return names;
}
