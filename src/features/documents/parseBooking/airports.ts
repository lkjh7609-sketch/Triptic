/**
 * 공항 DB 조회 (04-document-ai.md §7.1)
 * data/airports.json(9,055개, `scripts/update-airports.js`로 생성 — OurAirports
 * 퍼블릭 도메인 + tz-lookup으로 계산한 IANA 시간대)을 대상으로 한다.
 *
 * ⚠️ JSON을 이 파일이 직접 import하지 않는다 — Vite(resolveJsonModule)와
 * Deno(`with { type: "json" }` 구문 필수)의 JSON import 문법이 달라서,
 * 각 런타임의 진입점이 자기 방식대로 읽어 이 모듈에 주입(DI)하게 한다.
 */

export interface AirportEntry {
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  /** IANA 시간대, 예: 'Asia/Seoul' */
  tz: string;
}

export type AirportIndex = Readonly<Record<string, AirportEntry>>;

export function createAirportIndex(data: Record<string, AirportEntry>): AirportIndex {
  return data;
}

export function lookupAirport(index: AirportIndex, iataCode: string | null | undefined): AirportEntry | null {
  if (!iataCode) return null;
  return index[iataCode.toUpperCase()] ?? null;
}
