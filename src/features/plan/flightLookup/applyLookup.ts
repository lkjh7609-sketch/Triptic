import { selectedAirportOf, type SelectedAirport } from '../airports/AirportPicker';
import type { Airport } from '../airports/airportData';
import type { TerminalKey, LookupAirport, LookupFlight } from './schedule';

/** 우리 공항 목록(IATA)에서 조회 결과의 공항을 찾아 선택 항목으로 — 목록에 없는 공항이면 API가 준 한국어 이름을 쓰고 좌표는 비운다 */
export function airportFromLookup(
  a: LookupAirport,
  airports: readonly Airport[] | undefined,
  language: string,
): SelectedAirport {
  const hit = airports?.find((x) => x.iata === a.iata);
  if (hit) return selectedAirportOf(hit, language);
  return { iata: a.iata, name: a.nameKo, lat: null, lng: null };
}

export interface LookupFill {
  flightNo: string;
  date: string;
  /** 한국어 이름(API 원문) */
  airline: string;
  airlineCode: string;
  dep: { airport: SelectedAirport; time: string; terminal: TerminalKey | null };
  arr: { airport: SelectedAirport; time: string; terminal: TerminalKey | null };
}

export function lookupFill(
  flight: LookupFlight,
  airports: readonly Airport[] | undefined,
  language: string,
): LookupFill {
  return {
    flightNo: flight.flightNo,
    date: flight.date,
    airline: flight.airlineKo,
    airlineCode: flight.airlineCode,
    dep: {
      airport: airportFromLookup(flight.dep, airports, language),
      time: flight.dep.time,
      terminal: flight.dep.terminal,
    },
    arr: {
      airport: airportFromLookup(flight.arr, airports, language),
      time: flight.arr.time,
      terminal: flight.arr.terminal,
    },
  };
}
