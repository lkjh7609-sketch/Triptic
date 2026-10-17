import { selectedAirportOf, type SelectedAirport } from '../plan/airports/AirportPicker';
import { searchAirports, type Airport } from '../plan/airports/airportData';
import type { LookupFill } from '../plan/flightLookup/applyLookup';
import type { ParsedFlight } from './parseBooking/schema';

/**
 * 서류 인식 결과 확인 — 비어 있는 칸을 자동으로 채운다(사용자가 고친 값·서류에서 읽은 값은 덮지 않는다).
 *  1) 공항 코드는 없고 이름만 읽힌 경우(예: '오사카(간사이)') → 우리 공항 목록에서 한 곳으로 좁혀질 때만 채운다('오사카'만으로는 KIX·ITM 둘이라 안 채움)
 *  2) 그래도 공항·시각이 비면 편명+출발일로 항공편 조회(flight-lookup, 한국 공항을 오가는 편만) → 빈 칸만 채운다
 */

type Side = 'departure' | 'arrival';

export const isIata = (v: string | null | undefined): v is string => !!v && /^[A-Z]{3}$/.test(v);

/** 'YYYY-MM-DDTHH:mm(:ss)' → 날짜·시각(없으면 '') */
export function splitLocal(local: string | null | undefined): { date: string; time: string } {
  const [date = '', time = ''] = (local ?? '').split('T');
  return { date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '', time: /^\d{2}:\d{2}/.test(time) ? time.slice(0, 5) : '' };
}

export function joinLocal(date: string, time: string): string | null {
  if (!date && !time) return null;
  return `${date}T${time}`;
}

/** 날짜·시각이 둘 다 있어야 일정에 넣을 수 있다 */
export function hasDateTime(local: string | null | undefined): boolean {
  const { date, time } = splitLocal(local);
  return !!date && !!time;
}

/** 공항 이름 글자로 우리 목록에서 한 곳을 찾는다. 이름 안의 코드('Kansai (KIX)'), 괄호 안·밖 낱말을 차례로 보고, 결과가 딱 하나일 때만 */
export function matchAirportByName(name: string | null | undefined, list: readonly Airport[]): Airport | null {
  if (!name || list.length === 0) return null;
  for (const code of name.match(/\b[A-Z]{3}\b/g) ?? []) {
    const hit = list.find((a) => a.iata === code);
    if (hit) return hit;
  }
  const parts = [name, ...name.split(/[()（）[\]/,·]/)].map((s) => s.trim()).filter((s) => s.length >= 2);
  for (const part of parts) {
    const found = searchAirports(list, part, { limit: 2 });
    if (found.length === 1) return found[0];
  }
  return null;
}

function withAirport(flight: ParsedFlight, side: Side, a: SelectedAirport): ParsedFlight {
  return {
    ...flight,
    [side]: {
      ...flight[side],
      airportIata: { value: a.iata, confidence: 1 },
      airportName: { value: a.name, confidence: 1 },
      airportLat: a.lat,
      airportLng: a.lng,
    },
  };
}

/** 1) 이름으로 공항 채우기 — 바뀐 게 없으면 같은 객체를 돌려준다 */
export function fillAirportsByName(flight: ParsedFlight, list: readonly Airport[], language: string): ParsedFlight {
  let next = flight;
  for (const side of ['departure', 'arrival'] as const) {
    if (isIata(next[side].airportIata.value)) continue;
    const hit = matchAirportByName(next[side].airportName.value, list);
    if (hit) next = withAirport(next, side, selectedAirportOf(hit, language));
  }
  return next;
}

/** 2) 조회가 필요한가 — 공항 코드나 날짜·시각이 하나라도 비었고, 편명과 출발일이 있을 때 */
export function lookupQuery(flight: ParsedFlight): { flightNo: string; date: string } | null {
  const missing =
    !isIata(flight.departure.airportIata.value) ||
    !isIata(flight.arrival.airportIata.value) ||
    !hasDateTime(flight.departure.scheduledLocal.value) ||
    !hasDateTime(flight.arrival.scheduledLocal.value);
  const flightNo = flight.flightNumber.value?.replace(/\s+/g, '').toUpperCase() ?? '';
  const { date } = splitLocal(flight.departure.scheduledLocal.value);
  return missing && flightNo && date ? { flightNo, date } : null;
}

/** 2) 조회 결과로 빈 칸만 채운다 — 바뀐 게 없으면 같은 객체 */
export function fillFromLookup(flight: ParsedFlight, fill: LookupFill): ParsedFlight {
  let next = flight;
  const legs = [
    ['departure', fill.dep, fill.date],
    ['arrival', fill.arr, fill.arrDate ?? fill.date],
  ] as const;
  for (const [side, leg, legDate] of legs) {
    if (!isIata(next[side].airportIata.value)) next = withAirport(next, side, leg.airport);
    const cur = splitLocal(next[side].scheduledLocal.value);
    const date = cur.date || legDate;
    const time = cur.time || leg.time;
    if (date !== cur.date || time !== cur.time) {
      next = { ...next, [side]: { ...next[side], scheduledLocal: { value: joinLocal(date, time), confidence: 1 } } };
    }
  }
  return next;
}
