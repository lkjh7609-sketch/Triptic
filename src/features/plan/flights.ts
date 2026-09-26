/**
 * 항공편 표시 로직 (index.html에서 이식 — ADR-001)
 * 원본: index.html extractLocalTime/flightPreviewText (2026-09-20 기준 라인 6181~6263).
 * React는 자동으로 이스케이프하므로 원본의 escapeHtml 호출은 옮기지 않았다.
 */
import type { TFunction } from 'i18next';
import type { FlightInfo } from './types';

export function extractLocalTime(scheduledStr: string | undefined | null): string {
  if (!scheduledStr) return '';
  const m = scheduledStr.match(/T(\d{2}:\d{2})/);
  return m ? m[1] : '';
}


/** 항공편 한 줄 요약 — 번역 함수를 받아 표시 언어로 만든다 */
export function flightPreviewText(f: FlightInfo | null, t: TFunction): string {
  if (!f) return '';
  const summary = t('plan:flight.preview', {
    dep: f.dep.iata || f.dep.name || '?',
    depTime: f.dep.time || '',
    arr: f.arr.iata || f.arr.name || '?',
    arrTime: f.arr.time || '',
  });
  return `${f.airline ? `${f.airline} · ` : ''}${summary}${f.manual ? ` ${t('plan:flight.manualSuffix')}` : ''}`;
}
