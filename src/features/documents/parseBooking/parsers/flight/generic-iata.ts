/**
 * IATA 표준 e-티켓 레이아웃 폴백 파서 (04-document-ai.md §4.1)
 * 항공사별 전용 파서가 없거나 detect 점수가 낮을 때 쓰는 최후의 결정론적
 * 파서다. 항공사마다 실제 레이아웃이 달라 label 기반 파싱은 하지 않고,
 * 텍스트 전체에서 "편명 · 실재하는 공항 코드 2개 · 시각 2개 · 날짜"를
 * 찾아 조합한다 — 실재 공항 DB로 교차 검증하기 때문에 "THE"/"AND" 같은
 * 대문자 3글자 오탐은 자연히 걸러진다.
 *
 * 전용 파서보다 신뢰도가 낮다(§8 "결정론적 파서(detect≥0.7) 0.92" 대비 이
 * 파서는 detect 상한 자체를 0.75로 잡아 항상 항공사 전용 파서보다 밀린다).
 */
import { FLIGHT_NUMBER, PNR, TIME_24H } from '../../patterns';
import { lookupAirport } from '../../airports';
import type { ParsedFlight } from '../../schema';
import type { BookingParser, ParseContext } from '../registry';

const AIRPORT_CODE_CANDIDATE = /\b[A-Z]{3}\b/g;
const PNR_LABEL_NEAR = /(booking reference|confirmation|pnr|예약번호|예약\s*번호)/i;

function field<T>(value: T | null, confidence: number) {
  return { value, confidence };
}

function findAirportCodes(text: string, ctx: ParseContext): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(AIRPORT_CODE_CANDIDATE)) {
    const code = m[0];
    if (seen.has(code)) continue;
    if (!lookupAirport(ctx.airports, code)) continue; // 실재 공항만 채택 — 오탐 방지
    seen.add(code);
    found.push(code);
  }
  return found;
}

function findFirstDateIso(text: string): string | null {
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const slash = text.match(/(\d{4})[./](\d{1,2})[./](\d{1,2})/);
  if (slash) return `${slash[1]}-${slash[2].padStart(2, '0')}-${slash[3].padStart(2, '0')}`;
  return null;
}

function findBookingReference(text: string): { value: string | null; confidence: number } {
  const lines = text.split('\n');
  for (const line of lines) {
    if (PNR_LABEL_NEAR.test(line)) {
      const m = line.match(/\b([A-Z0-9]{6})\b/);
      if (m) return field(m[1], 0.8);
    }
  }
  PNR.lastIndex = 0;
  const m = PNR.exec(text);
  return m ? field(m[1], 0.4) : field(null, 0);
}

export const genericIataParser: BookingParser = {
  id: 'flight/generic-iata',
  version: '1.0.0',

  detect(text: string): number {
    FLIGHT_NUMBER.lastIndex = 0;
    const hasFlightNo = FLIGHT_NUMBER.test(text);
    TIME_24H.lastIndex = 0;
    const hasTime = TIME_24H.test(text);
    const airportCount = new Set(text.match(AIRPORT_CODE_CANDIDATE) ?? []).size;
    if (hasFlightNo && hasTime && airportCount >= 2) return 0.75;
    if (hasFlightNo && airportCount >= 2) return 0.5;
    return 0;
  },

  parse(text: string, ctx: ParseContext): ParsedFlight[] {
    FLIGHT_NUMBER.lastIndex = 0;
    const flightMatch = FLIGHT_NUMBER.exec(text);
    const flightNumber = flightMatch ? `${flightMatch[1]}${flightMatch[2]}` : null;

    const airportCodes = findAirportCodes(text, ctx);
    const depCode = airportCodes[0] ?? null;
    const arrCode = airportCodes[1] ?? null;

    TIME_24H.lastIndex = 0;
    const times: string[] = [];
    for (const m of text.matchAll(TIME_24H)) times.push(`${m[1].padStart(2, '0')}:${m[2]}`);
    const depTime = times[0] ?? null;
    const arrTime = times[1] ?? null;

    const dateIso = findFirstDateIso(text);
    const depLocal = dateIso && depTime ? `${dateIso}T${depTime}` : null;
    const arrLocal = dateIso && arrTime ? `${dateIso}T${arrTime}` : null;

    const depAirport = depCode ? lookupAirport(ctx.airports, depCode) : null;
    const arrAirport = arrCode ? lookupAirport(ctx.airports, arrCode) : null;

    const flight: ParsedFlight = {
      kind: 'flight',
      carrierIata: field(flightNumber ? flightNumber.slice(0, 2) : null, flightNumber ? 0.7 : 0),
      carrierName: field(null, 0),
      flightNumber: field(flightNumber, flightNumber ? 0.8 : 0),
      departure: {
        airportIata: field(depCode, depAirport ? 0.9 : 0),
        airportName: field(depAirport?.name ?? null, depAirport ? 0.9 : 0),
        terminal: field(null, 0),
        scheduledLocal: field(depLocal, depLocal ? 0.7 : 0),
      },
      arrival: {
        airportIata: field(arrCode, arrAirport ? 0.9 : 0),
        airportName: field(arrAirport?.name ?? null, arrAirport ? 0.9 : 0),
        terminal: field(null, 0),
        scheduledLocal: field(arrLocal, arrLocal ? 0.7 : 0),
      },
      bookingReference: findBookingReference(text),
      seat: field(null, 0),
      cabinClass: field(null, 0),
    };

    return [flight];
  },
};
