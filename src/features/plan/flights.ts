/**
 * 항공편 표시 로직 (index.html에서 이식 — ADR-001)
 * 원본: index.html extractLocalTime/flightPreviewText (2026-09-20 기준 라인 6181~6263).
 * React는 자동으로 이스케이프하므로 원본의 escapeHtml 호출은 옮기지 않았다.
 */
import i18next, { type TFunction } from 'i18next';
import type { FlightAirportInfo, FlightInfo } from './types';
import { airlineDisplayName } from './flightLookup/airlineNames';

export function extractLocalTime(scheduledStr: string | undefined | null): string {
  if (!scheduledStr) return '';
  const m = scheduledStr.match(/T(\d{2}:\d{2})/);
  return m ? m[1] : '';
}


/** 표시 언어에 맞는 항공사 이름 — 한국어는 저장된 이름 그대로, 그 밖은 코드로 공식 이름표에서(코드가 없거나 표에 없으면 저장된 이름) */
export function flightAirlineLabel(f: Pick<FlightInfo, 'airline' | 'airlineCode'>, locale: string = i18next.language): string {
  return airlineDisplayName(f.airlineCode, locale, f.airline);
}

/** 공항 코드(없으면 이름) + 터미널(있으면) — 예: "ICN T2" */
function airportLabel(a: FlightAirportInfo, t: TFunction): string {
  const base = a.iata || a.name || '?';
  return a.terminal ? `${base} ${t(`home:airport.terminalShort.${a.terminal}`)}` : base;
}

/** 항공편 한 줄 요약 — 번역 함수를 받아 표시 언어로 만든다 */
export function flightPreviewText(f: FlightInfo | null, t: TFunction, locale: string = i18next.language): string {
  if (!f) return '';
  const summary = t('plan:flight.preview', {
    dep: airportLabel(f.dep, t),
    depTime: f.dep.time || '',
    arr: airportLabel(f.arr, t),
    arrTime: f.arr.time || '',
  });
  const airline = flightAirlineLabel(f, locale);
  return `${airline ? `${airline} · ` : ''}${summary}${f.manual ? ` ${t('plan:flight.manualSuffix')}` : ''}`;
}
