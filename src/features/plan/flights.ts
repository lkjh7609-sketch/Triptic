/**
 * 항공편 표시 로직 (index.html에서 이식 — ADR-001)
 * 원본: index.html extractLocalTime/flightPreviewText (2026-09-20 기준 라인 6181~6263).
 * React는 자동으로 이스케이프하므로 원본의 escapeHtml 호출은 옮기지 않았다.
 */
import type { FlightInfo } from './types';

export function extractLocalTime(scheduledStr: string | undefined | null): string {
  if (!scheduledStr) return '';
  const m = scheduledStr.match(/T(\d{2}:\d{2})/);
  return m ? m[1] : '';
}

export function flightPreviewText(f: FlightInfo | null): string {
  if (!f) return '';
  const airlineText = f.airline ? `${f.airline} · ` : '';
  const depText = f.dep.iata || f.dep.name || '?';
  const arrText = f.arr.iata || f.arr.name || '?';
  return `✅ ${airlineText}${depText} ${f.dep.time || ''} 출발 → ${arrText} ${f.arr.time || ''} 도착${f.manual ? ' (직접 입력)' : ''}`;
}
