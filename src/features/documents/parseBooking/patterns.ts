/* i18n-exempt-file: 한국어 예약 문서를 읽기 위한 정규식 */
/**
 * 결정론적 파서 공용 패턴 (04-document-ai.md §4.3)
 */

export const IATA_AIRPORT = /\b([A-Z]{3})\b/g;
export const FLIGHT_NUMBER = /\b([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?(\d{1,4})\b/g;
/** 후보만 — 반드시 별도 검증(공항 실재 여부 등)을 거칠 것 */
export const PNR = /\b([A-Z0-9]{6})\b/g;
export const TIME_24H = /\b([01]?\d|2[0-3]):([0-5]\d)\b/g;

/** 날짜는 로케일마다 다르다 — 여러 형식을 시도하고 여행 기간으로 교차 검증한다(§4.3) */
export const DATE_PATTERNS: RegExp[] = [
  /(\d{4})[-./](\d{1,2})[-./](\d{1,2})/, // 2026-05-20
  /(\d{1,2})[-./](\d{1,2})[-./](\d{4})/, // 20/05/2026 · 05/20/2026 ⚠️ 모호
  /(\d{1,2})\s*(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*(\d{2,4})/i,
  /(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/, // ja/zh
  /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/, // ko
];

const MONTH_NAMES = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];

export interface ResolvedDate {
  year: number;
  month: number; // 1-12
  day: number;
  /** DD/MM·MM/DD처럼 두 해석이 모두 가능해 신뢰도를 낮춰야 하는 경우 */
  ambiguous: boolean;
}

/**
 * DD/MM vs MM/DD 모호성 해소 (§4.3):
 * 1. 한쪽 숫자가 12를 넘으면 그쪽이 일(day)이다
 * 2. 그래도 모호하면 여행 기간 안에 들어가는 해석을 택한다
 * 3. 둘 다 기간 안이면 신뢰도를 낮추고 사용자에게 묻는다(ambiguous=true) — 임의로 고르지 않는다
 */
export function resolveAmbiguousDayMonth(
  a: number,
  b: number,
  year: number,
  tripStartDate: string,
  tripEndDate: string,
): ResolvedDate | null {
  if (a > 31 || b > 31 || (a > 12 && b > 12)) return null;

  if (a > 12) return { year, month: b, day: a, ambiguous: false };
  if (b > 12) return { year, month: a, day: b, ambiguous: false };

  const candidateA = { year, month: a, day: b, ambiguous: false }; // a=월, b=일
  const candidateB = { year, month: b, day: a, ambiguous: false }; // b=월, a=일
  const inRangeA = isInRange(candidateA, tripStartDate, tripEndDate);
  const inRangeB = isInRange(candidateB, tripStartDate, tripEndDate);

  if (inRangeA && !inRangeB) return candidateA;
  if (inRangeB && !inRangeA) return candidateB;
  // 둘 다 기간 안(또는 둘 다 밖) — 임의로 고르지 않고 모호함을 표시한다
  return { ...candidateA, ambiguous: true };
}

function isInRange(d: { year: number; month: number; day: number }, start: string, end: string): boolean {
  const iso = `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
  return iso >= start && iso <= end;
}

export function monthNameToNumber(name: string): number | null {
  const idx = MONTH_NAMES.indexOf(name.toUpperCase());
  return idx === -1 ? null : idx + 1;
}
