import type { FlightDeal } from '../flightDealsData';

/** "10월~11월" — 이달과 다음 달을 언어에 맞는 짧은 월 이름으로 */
export function monthRange(month: number, locale: string): string {
  const fmt = new Intl.DateTimeFormat(locale, { month: 'short' });
  const name = (m: number) => fmt.format(new Date(2026, (m - 1) % 12, 1));
  return `${name(month)}~${name((month % 12) + 1)}`;
}

/** 글 본문을 제목(첫 줄)과 요약(나머지)으로 나눈다 — 글에는 따로 제목이 없다 */
export function splitPostBody(body: string): { title: string; summary: string } {
  const lines = body
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  return { title: lines[0] ?? '', summary: lines.slice(1).join(' ') };
}

export const HOME_DEAL_COUNT = 4;

/** 할인율이 큰 순서(없으면 가격 순)로 4개 */
export function pickHomeDeals(deals: FlightDeal[]): FlightDeal[] {
  return [...deals].sort((a, b) => (b.discountPct ?? 0) - (a.discountPct ?? 0) || a.price - b.price).slice(0, HOME_DEAL_COUNT);
}
