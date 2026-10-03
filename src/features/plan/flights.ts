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
export function flightAirlineLabel(
  f: Pick<FlightInfo, 'airline' | 'airlineCode'>,
  locale: string = i18next.language,
): string {
  return airlineDisplayName(f.airlineCode, locale, f.airline);
}

/** 공항 코드(없으면 이름) + 터미널(있으면) — 예: "ICN T2" */
function airportLabel(a: FlightAirportInfo, t: TFunction): string {
  const base = a.iata || a.name || '?';
  return a.terminal ? `${base} ${t(`home:airport.terminalShort.${a.terminal}`)}` : base;
}

/** 항공편 한 줄 요약 — 번역 함수를 받아 표시 언어로 만든다 */
export function flightPreviewText(
  f: FlightInfo | null,
  t: TFunction,
  locale: string = i18next.language,
): string {
  if (!f) return '';
  const summary = t('plan:flight.preview', {
    dep: airportLabel(f.dep, t),
    depTime: f.dep.time || '',
    arr: airportLabel(f.arr, t),
    // 밤새 날아와 도착일이 다르면 날짜를 붙인다(예: 10/22 04:35)
    arrTime:
      f.arrDate && f.arrDate !== f.date
        ? `${f.arrDate.slice(5).replace('-', '/')} ${f.arr.time || ''}`.trim()
        : f.arr.time || '',
  });
  const airline = flightAirlineLabel(f, locale);
  return `${airline ? `${airline} · ` : ''}${summary}${f.manual ? ` ${t('plan:flight.manualSuffix')}` : ''}`;
}

function ymdDiff(a: string, b: string): number {
  return Math.round(
    (new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000,
  );
}

/**
 * 귀국편 카드가 보일 일차 — 밤새 날아와 도착일(arrDate)이 정해져 있으면 그날의 일차, 아니면 마지막 일차.
 * 여행 범위 밖이면 가장 가까운 일차로 맞춘다.
 */
export function returnFlightDay(
  flight: Pick<FlightInfo, 'arrDate'> | null | undefined,
  tripStartDate: string | null | undefined,
  totalDays: number,
): number {
  if (!flight?.arrDate || !tripStartDate) return totalDays;
  const day = ymdDiff(tripStartDate, flight.arrDate) + 1;
  return Math.min(Math.max(day, 1), totalDays);
}

/** 항공편 카드의 시간 줄 — 출발 시간을 모르면(상대 공항에서 오는 편) 도착 시간만 */
export function flightScheduleText(f: FlightInfo, t: TFunction): string {
  return f.dep.time
    ? t('plan:flightCard.schedule', { depTime: f.dep.time, arrTime: f.arr.time || '' })
    : t('plan:flightCard.arriveOnly', { arrTime: f.arr.time || '' });
}

/**
 * 밤새 날아와 도착일(arrDate)이 여행 종료일보다 늦은 항공편이 있으면 새 종료일(가장 늦은 도착일), 아니면 null.
 * 늘리기만 하고 줄이지는 않는다.
 */
export function tripEndExtension(
  flights: {
    outbound: Pick<FlightInfo, 'arrDate'> | null;
    return: Pick<FlightInfo, 'arrDate'> | null;
  },
  tripEndDate: string | null | undefined,
): string | null {
  if (!tripEndDate) return null;
  const latest = [flights.outbound?.arrDate, flights.return?.arrDate]
    .filter((d): d is string => !!d)
    .sort()
    .at(-1);
  return latest && latest > tripEndDate ? latest : null;
}
