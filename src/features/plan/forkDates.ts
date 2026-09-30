/** 커뮤니티 일정 복사 — 새 출발일에 맞춰 날짜를 옮기는 계산(일 수는 그대로). 전부 UTC 기준 'yyyy-MM-dd'라 서머타임에 흔들리지 않는다 */

const DAY_MS = 86_400_000;

function toUtc(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** ymd에서 days일 뒤(음수면 앞) */
export function shiftYmd(ymd: string, days: number): string {
  return fromUtc(toUtc(ymd) + days * DAY_MS);
}

/** from → to 사이의 일 수(to가 뒤면 양수) */
export function diffDays(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

export interface ForkDates {
  startDate: string;
  endDate: string;
  /** 원래 출발일에서 얼마나 옮겼는가(일) — 항공편 날짜 같은 딸린 날짜를 같이 옮길 때 쓴다 */
  offsetDays: number;
}

/** 원본의 일 수는 그대로 두고 새 출발일부터 이어지게 */
export function forkDates(originalStart: string, totalDays: number, newStart?: string | null): ForkDates {
  const start = newStart || originalStart;
  return { startDate: start, endDate: shiftYmd(start, Math.max(1, totalDays) - 1), offsetDays: diffDays(originalStart, start) };
}
