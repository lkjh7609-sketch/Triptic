/**
 * 파싱 결과 스키마 (04-document-ai.md §6.4) — 서버(Deno Edge Function)·클라
 * 공용. LLM structured output과 결정론적 파서 출력이 공통으로 이 모양을 따른다.
 *
 * 각 필드는 단순 값이 아니라 `{ value, confidence }`다 — "조용한 자동 확정
 * 금지"(§1) 원칙상 필드 단위 신뢰도가 항상 같이 다녀야 검수 시트에서 색으로
 * 구분해 보여줄 수 있다.
 */
import { z } from 'zod';

export const Confidence = z.number().min(0).max(1);

const LOCAL_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function F<T extends z.ZodTypeAny>(v: T) {
  return z.object({ value: v.nullable(), confidence: Confidence });
}

export const ParsedFlight = z.object({
  kind: z.literal('flight'),
  carrierIata: F(z.string().regex(/^[A-Z0-9]{2}$/)),
  carrierName: F(z.string()),
  flightNumber: F(z.string().regex(/^[A-Z0-9]{2}\d{1,4}$/)),
  departure: z.object({
    airportIata: F(z.string().length(3)),
    airportName: F(z.string()),
    terminal: F(z.string()),
    scheduledLocal: F(z.string().regex(LOCAL_DATETIME_RE)),
    /** LLM/파서가 채우지 않아도 된다(optional) — resolveFlightAirports()가 공항 DB
     * 조회 결과로 채운다. 커밋 시(§9) 지도 렌더링에 좌표가 필요해서 스키마에 넣었다
     * (신뢰도 없음 — 추출값이 아니라 DB 조회값). */
    airportLat: z.number().nullable().optional(),
    airportLng: z.number().nullable().optional(),
  }),
  arrival: z.object({
    airportIata: F(z.string().length(3)),
    airportName: F(z.string()),
    terminal: F(z.string()),
    scheduledLocal: F(z.string().regex(LOCAL_DATETIME_RE)),
    airportLat: z.number().nullable().optional(),
    airportLng: z.number().nullable().optional(),
  }),
  bookingReference: F(z.string()),
  seat: F(z.string()),
  cabinClass: F(z.enum(['economy', 'premium_economy', 'business', 'first'])),
});
export type ParsedFlight = z.infer<typeof ParsedFlight>;

export const ParsedLodging = z.object({
  kind: z.literal('lodging'),
  propertyName: F(z.string()),
  address: F(z.string()),
  checkInLocal: F(z.string().regex(LOCAL_DATETIME_RE)),
  checkOutLocal: F(z.string().regex(LOCAL_DATETIME_RE)),
  roomType: F(z.string()),
  guestCount: F(z.number().int().positive()),
  bookingReference: F(z.string()),
  phone: F(z.string()),
});
export type ParsedLodging = z.infer<typeof ParsedLodging>;

export const ParsedRail = z.object({
  kind: z.literal('rail'),
  carrierName: F(z.string()),
  trainNumber: F(z.string()),
  departure: z.object({
    stationName: F(z.string()),
    scheduledLocal: F(z.string().regex(LOCAL_DATETIME_RE)),
  }),
  arrival: z.object({
    stationName: F(z.string()),
    scheduledLocal: F(z.string().regex(LOCAL_DATETIME_RE)),
  }),
  seat: F(z.string()),
  bookingReference: F(z.string()),
});
export type ParsedRail = z.infer<typeof ParsedRail>;

export const ParsedCarRental = z.object({
  kind: z.literal('car_rental'),
  company: F(z.string()),
  vehicleType: F(z.string()),
  pickup: z.object({
    locationName: F(z.string()),
    scheduledLocal: F(z.string().regex(LOCAL_DATETIME_RE)),
  }),
  dropoff: z.object({
    locationName: F(z.string()),
    scheduledLocal: F(z.string().regex(LOCAL_DATETIME_RE)),
  }),
  bookingReference: F(z.string()),
});
export type ParsedCarRental = z.infer<typeof ParsedCarRental>;

export const ParsedActivity = z.object({
  kind: z.literal('activity'),
  name: F(z.string()),
  address: F(z.string()),
  scheduledLocal: F(z.string().regex(LOCAL_DATETIME_RE)),
  durationMinutes: F(z.number().int().positive()),
  bookingReference: F(z.string()),
});
export type ParsedActivity = z.infer<typeof ParsedActivity>;

export const ParsedBooking = z.discriminatedUnion('kind', [
  ParsedFlight,
  ParsedLodging,
  ParsedRail,
  ParsedCarRental,
  ParsedActivity,
]);
export type ParsedBooking = z.infer<typeof ParsedBooking>;

export const ParseResponse = z.object({
  documentId: z.string().uuid(),
  bookings: z.array(ParsedBooking),
  /** 'flight/korean-air@1.2' 또는 'llm/gemini-2.5-flash' */
  parserUsed: z.string(),
  warnings: z.array(z.string()),
});
export type ParseResponse = z.infer<typeof ParseResponse>;
