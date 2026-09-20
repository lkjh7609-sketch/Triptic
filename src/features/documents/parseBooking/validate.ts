/**
 * 결정론적 검증 — 환각 방어선 (04-document-ai.md §7)
 * LLM 출력을 그대로 믿지 않는다. 여기를 통과해야 신뢰도를 유지한다.
 * 공항 좌표·타임존은 항상 번들 DB에서 가져온다 — LLM이 준 값은 쓰지 않는다.
 */
import { fromZonedTime } from 'date-fns-tz';
import type { AirportIndex } from './airports';
import { lookupAirport } from './airports';
import type { ParsedFlight, ParsedLodging } from './schema';

const FLIGHT_NUMBER_RE = /^[A-Z0-9]{2}\d{1,4}$/;
/** 상업 여객기 평균 순항 계획 속도(대권거리 기준 근사치) + 이착륙/지상 대기 여유시간 */
const CRUISE_KMH = 800;
const GROUND_OVERHEAD_MIN = 30;

export interface VerifyContext {
  airports: AirportIndex;
  tripStartDate: string; // YYYY-MM-DD
  tripEndDate: string; // YYYY-MM-DD
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** 날짜가 여행 기간(-1일~+1일 여유) 안인지 (§7 "날짜가 여행 기간 내") */
export function isWithinTripRange(dateLocal: string, ctx: VerifyContext): boolean {
  const date = dateLocal.slice(0, 10);
  const start = addDaysIso(ctx.tripStartDate, -1);
  const end = addDaysIso(ctx.tripEndDate, 1);
  return date >= start && date <= end;
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * 항공편 검증(§7 표 전체) — 필드별 신뢰도를 낮추고(절대 올리지 않는다) 경고를 쌓는다.
 * 입력을 변형하지 않고 새 객체를 반환한다.
 */
export function verifyParsedFlight(
  flight: ParsedFlight,
  ctx: VerifyContext,
): { flight: ParsedFlight; warnings: string[] } {
  const warnings: string[] = [];
  const next: ParsedFlight = structuredClone(flight);

  const depAirport = lookupAirport(ctx.airports, next.departure.airportIata.value);
  if (next.departure.airportIata.value && !depAirport) {
    next.departure.airportIata = { value: null, confidence: 0 };
    warnings.push('출발 공항 코드가 실재 공항 DB에 없어 비웠습니다.');
  }
  // 커밋 시(§9) 지도 렌더링에 필요한 좌표 — 추출값이 아니라 DB 조회값이라 신뢰도는 없다
  next.departure.airportLat = depAirport?.lat ?? null;
  next.departure.airportLng = depAirport?.lng ?? null;

  const arrAirport = lookupAirport(ctx.airports, next.arrival.airportIata.value);
  if (next.arrival.airportIata.value && !arrAirport) {
    next.arrival.airportIata = { value: null, confidence: 0 };
    warnings.push('도착 공항 코드가 실재 공항 DB에 없어 비웠습니다.');
  }
  next.arrival.airportLat = arrAirport?.lat ?? null;
  next.arrival.airportLng = arrAirport?.lng ?? null;

  if (next.flightNumber.value && !FLIGHT_NUMBER_RE.test(next.flightNumber.value)) {
    next.flightNumber.confidence = Math.min(next.flightNumber.confidence, 0.3);
    warnings.push('편명 형식이 일반적이지 않습니다.');
  }

  const depLocal = next.departure.scheduledLocal.value;
  const arrLocal = next.arrival.scheduledLocal.value;
  if (depAirport && arrAirport && depLocal && arrLocal) {
    const depUtc = fromZonedTime(depLocal, depAirport.tz);
    const arrUtc = fromZonedTime(arrLocal, arrAirport.tz);
    const durationMin = (arrUtc.getTime() - depUtc.getTime()) / 60_000;

    if (durationMin <= 0) {
      next.arrival.scheduledLocal.confidence = Math.min(next.arrival.scheduledLocal.confidence, 0.4);
      warnings.push('도착 시각이 출발 시각보다 빠르거나 같습니다.');
    } else {
      const distanceKm = haversineKm(depAirport.lat, depAirport.lng, arrAirport.lat, arrAirport.lng);
      const expectedMin = (distanceKm / CRUISE_KMH) * 60 + GROUND_OVERHEAD_MIN;
      const ratio = durationMin / expectedMin;
      if (ratio < 0.6 || ratio > 2.0) {
        next.arrival.scheduledLocal.confidence = Math.min(next.arrival.scheduledLocal.confidence, 0.5);
        warnings.push('비행 시간이 두 공항 간 거리에 비해 비정상적입니다.');
      }
    }
  }

  if (depLocal && !isWithinTripRange(depLocal, ctx)) {
    next.departure.scheduledLocal.confidence = Math.min(next.departure.scheduledLocal.confidence, 0.5);
    warnings.push('출발일이 여행 기간과 맞지 않습니다 — 다른 여행의 예약인가요?');
  }

  return { flight: next, warnings };
}

/** 숙소 검증(§7 표: 체크아웃>체크인, 날짜가 여행 기간 내) — 좌표 해석(Google Places)은
 * 별도 단계(엣지 함수 진입점에서 injectable geocode 콜백으로 수행, 이 모듈은 순수하게 유지) */
export function verifyParsedLodging(
  lodging: ParsedLodging,
  ctx: VerifyContext,
): { lodging: ParsedLodging; warnings: string[] } {
  const warnings: string[] = [];
  const next: ParsedLodging = structuredClone(lodging);

  const checkIn = next.checkInLocal.value;
  const checkOut = next.checkOutLocal.value;
  if (checkIn && checkOut && checkOut <= checkIn) {
    next.checkOutLocal.confidence = Math.min(next.checkOutLocal.confidence, 0.4);
    warnings.push('체크아웃이 체크인보다 빠르거나 같습니다.');
  }
  if (checkIn && !isWithinTripRange(checkIn, ctx)) {
    next.checkInLocal.confidence = Math.min(next.checkInLocal.confidence, 0.5);
    warnings.push('체크인 날짜가 여행 기간과 맞지 않습니다 — 다른 여행의 예약인가요?');
  }

  return { lodging: next, warnings };
}
