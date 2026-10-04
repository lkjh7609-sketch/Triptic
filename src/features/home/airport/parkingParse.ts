/* i18n-exempt-file: 공항 API가 주는 한국어 공항·주차장 이름과 혼잡도 문구(원활·혼잡·만차)를 코드로 잇는 데이터 */
/**
 * 공항 주차장 실시간 데이터 정리 — Edge Function(airport-parking)과 화면이 같이 쓰는 순수 함수(외부 import 없음).
 *  · 한국공항공사: '전국공항 실시간 주차정보'(parking-realtime-status, 면수·주차 대수) + '주차장 혼잡도'(parking-congestion, 원활·혼잡·만차)
 *    두 API를 공항·주차장 이름으로 잇는다(13개 공항 25곳). 혼잡도 판정은 API 것을 그대로 쓴다(사용자 결정).
 *  · 인천국제공항공사: '주차 정보'(StatusOfParking, T1·T2 층별 19곳). 판정이 없어 점유율로 계산한다(사용자 결정: 90% 미만 원활, 96% 미만 혼잡, 그 이상 만차).
 *  · 주차 대수가 면수보다 많을 수 있다(통로 주차까지 세는 듯) → 남은 대수는 0, 만차(사용자 결정).
 */

export type Congestion = 'smooth' | 'busy' | 'full';

export interface ParkingLot {
  /** 공항 IATA 코드(ICN·GMP·PUS·CJU·TAE…). 모르는 공항이면 API의 한국어 이름 그대로 */
  airport: string;
  /** API가 주는 주차장 이름 그대로(평면도와 잇는 열쇠) */
  name: string;
  /** 주차면 수 */
  total: number;
  /** 지금 주차된 대수(면수보다 많을 수 있다) */
  occupied: number;
  congestion: Congestion;
  /** 그 주차장 값이 갱신된 시각(ISO, +09:00) — 모르면 null */
  updatedAt: string | null;
}

/** 한국공항공사 응답의 공항 이름 → IATA(주차 API에 나오는 13곳) */
export const KAC_AIRPORT_CODES: Record<string, string> = {
  김포국제공항: 'GMP',
  김해국제공항: 'PUS',
  제주국제공항: 'CJU',
  대구국제공항: 'TAE',
  청주국제공항: 'CJJ',
  광주공항: 'KWJ',
  여수공항: 'RSU',
  울산공항: 'USN',
  군산공항: 'KUV',
  원주공항: 'WJU',
  무안국제공항: 'MWX',
  사천공항: 'HIN',
  양양국제공항: 'YNY',
};

const KAC_LABELS: Record<string, Congestion> = { 원활: 'smooth', 혼잡: 'busy', 만차: 'full' };

/** 인천 판정 기준(점유율 %) */
export const BUSY_FROM = 90;
export const FULL_FROM = 96;

/** 점유율로 판정 — 인천, 그리고 한국공항공사 판정이 비었을 때 */
export function congestionByRate(occupied: number, total: number): Congestion {
  if (total <= 0 || occupied >= total) return 'full';
  const rate = (occupied / total) * 100;
  if (rate >= FULL_FROM) return 'full';
  if (rate >= BUSY_FROM) return 'busy';
  return 'smooth';
}

/** 남은 대수 — 면수보다 많이 서 있으면 0 */
export function remaining(lot: Pick<ParkingLot, 'total' | 'occupied'>): number {
  return Math.max(0, Math.round(lot.total - lot.occupied));
}

/** 점유율(%) — 100을 넘지 않게 자른다(초과 주차는 만차로만 보인다) */
export function occupancyPct(lot: Pick<ParkingLot, 'total' | 'occupied'>): number {
  if (lot.total <= 0) return 100;
  return Math.min(100, Math.max(0, (lot.occupied / lot.total) * 100));
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
}

/** '2026-10-04' + '18:53:03' → '2026-10-04T18:53:03+09:00' */
function kstIso(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}(:\d{2})?$/.test(time)) return null;
  return `${date}T${time.length === 5 ? `${time}:00` : time}+09:00`;
}

/** 인천 '20261004185841.000' → '2026-10-04T18:58:41+09:00' */
export function icnTime(datetm: unknown): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(str(datetm));
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+09:00` : null;
}

/** data.go.kr 응답에서 item 배열을 꺼낸다 — items가 배열이거나 {item: [...]}/{item: {...}}거나 */
export function extractParkingItems(json: unknown): Record<string, unknown>[] {
  const body = (json as { response?: { body?: { items?: unknown } } })?.response?.body;
  const items = body?.items as unknown;
  const list = Array.isArray(items) ? items : (items as { item?: unknown } | undefined)?.item;
  if (Array.isArray(list)) return list.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object');
  if (list && typeof list === 'object') return [list as Record<string, unknown>];
  return [];
}

/** 정상 응답(resultCode 00)인지 */
export function isNormalParkingResponse(json: unknown): boolean {
  return str((json as { response?: { header?: { resultCode?: unknown } } })?.response?.header?.resultCode) === '00';
}

const key = (airport: string, name: string) => `${airport}|${name}`;

/**
 * 한국공항공사 두 API → 주차장 목록. status가 기준(면수·대수·시각)이고, 판정은 congestion에서 같은 공항·이름으로 찾는다.
 * congestion을 못 받았으면(빈 배열) previous(직전에 저장해 둔 목록)의 판정을 쓰고, 그것도 없으면 점유율로 계산한다.
 */
export function normalizeKac(
  statusItems: Record<string, unknown>[],
  congestionItems: Record<string, unknown>[],
  previous: ParkingLot[] = [],
): ParkingLot[] {
  const labels = new Map<string, Congestion>();
  for (const it of congestionItems) {
    const airportName = str(it.airportKor);
    const label = KAC_LABELS[str(it.parkingCongestion)];
    if (airportName && label) labels.set(key(KAC_AIRPORT_CODES[airportName] ?? airportName, str(it.parkingAirportCodeName)), label);
  }
  const prevLabels = new Map(previous.map((l) => [key(l.airport, l.name), l.congestion]));
  const lots: ParkingLot[] = [];
  for (const it of statusItems) {
    const airportName = str(it.aprKor);
    const name = str(it.parkingAirportCodeName);
    if (!airportName || !name) continue;
    const airport = KAC_AIRPORT_CODES[airportName] ?? airportName;
    const total = num(it.parkingFullSpace);
    const occupied = num(it.parkingIstay);
    const k = key(airport, name);
    lots.push({
      airport,
      name,
      total,
      occupied,
      congestion: labels.get(k) ?? prevLabels.get(k) ?? congestionByRate(occupied, total),
      updatedAt: kstIso(str(it.parkingGetdate), str(it.parkingGettime)),
    });
  }
  return lots;
}

/** 인천 API → 주차장 목록(판정은 점유율로 계산) */
export function normalizeIcn(items: Record<string, unknown>[]): ParkingLot[] {
  const lots: ParkingLot[] = [];
  for (const it of items) {
    const name = str(it.floor);
    if (!name) continue;
    const total = num(it.parkingarea);
    const occupied = num(it.parking);
    lots.push({ airport: 'ICN', name, total, occupied, congestion: congestionByRate(occupied, total), updatedAt: icnTime(it.datetm) });
  }
  return lots;
}
