/**
 * 확정된 예약을 실제 여행 스냅샷에 반영한다 (04-document-ai.md §9 "일정 반영 규칙")
 *
 * ⚠️ 스펙 §9 원문은 정규화 테이블(itinerary_items)에 항목을 만드는 걸 전제하지만,
 * 이 앱은 아직 trips.snapshot(JSONB) 기반이다(정규화 이관 M2~M4 미완료 —
 * supabase/migrations/README.md, Phase 3 홈 대시보드 임시 RPC와 같은 이유).
 * itinerary_items에 써봐야 실제 화면 어디에도 안 보이므로, 이미 있는 스냅샷
 * 슬롯(flights/hotels/data)에 맞춰 넣는다 — 정규화 이관 후 대체할 임시 로직.
 *
 * 항공편은 공항 DB에서 좌표를 이미 채워뒀지만(validate.ts resolveFlightAirports),
 * 숙소/철도/렌터카/액티비티는 "장소명/주소" 텍스트만 있고 좌표가 없다(§7의
 * "호텔 좌표 → Google Places 해석"은 아직 구현 전) — 그래서 이 항목들은 커밋 시
 * 좌표가 필수인 기존 모달(SetHotelModal/AddPlaceModal)을 그대로 재사용해
 * 사용자가 정확한 장소를 검색·확정하게 한다(추출된 이름을 검색어로 미리 채움).
 * 이건 "조용한 자동 확정 금지"(§1) 원칙에도 더 맞는다 — 주소만으로 지오코딩하면
 * 같은 체인의 다른 지점을 잘못 고를 위험이 있다.
 */
import type { ParsedFlight } from './parseBooking/schema';
import type { FlightAirportInfo, FlightInfo } from '../plan/types';

function splitLocal(local: string | null | undefined): { date: string; time: string } | null {
  if (!local) return null;
  const [date, time] = local.split('T');
  if (!date || !time) return null;
  return { date, time };
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000);
}

export interface FlightCommitResult {
  slot: 'outbound' | 'return';
  flight: FlightInfo;
}

/**
 * ParsedFlight → FlightInfo 변환 + outbound/return 슬롯 판정.
 * 출발일이 여행 시작일에 더 가까우면 outbound, 도착일이 여행 종료일에 더
 * 가까우면 return으로 본다(왕복 중 어느 편인지 문서만으로는 명시적이지 않을 때가 많다).
 */
export function commitFlightBooking(
  flight: ParsedFlight,
  tripStartDate: string,
  tripEndDate: string,
): FlightCommitResult | null {
  const dep = splitLocal(flight.departure.scheduledLocal.value);
  const arr = splitLocal(flight.arrival.scheduledLocal.value);
  if (!dep || !arr || !flight.departure.airportIata.value || !flight.arrival.airportIata.value) return null;

  const distToStart = Math.abs(daysBetween(tripStartDate, dep.date));
  const distToEnd = Math.abs(daysBetween(arr.date, tripEndDate));
  const slot: 'outbound' | 'return' = distToStart <= distToEnd ? 'outbound' : 'return';

  const depAirport: FlightAirportInfo = {
    iata: flight.departure.airportIata.value,
    name: flight.departure.airportName.value ?? flight.departure.airportIata.value,
    lat: flight.departure.airportLat ?? null,
    lng: flight.departure.airportLng ?? null,
    time: dep.time,
  };
  const arrAirport: FlightAirportInfo = {
    iata: flight.arrival.airportIata.value,
    name: flight.arrival.airportName.value ?? flight.arrival.airportIata.value,
    lat: flight.arrival.airportLat ?? null,
    lng: flight.arrival.airportLng ?? null,
    time: arr.time,
  };

  return {
    slot,
    flight: {
      flightNo: flight.flightNumber.value ?? '',
      date: dep.date,
      airline: flight.carrierName.value ?? undefined,
      dep: depAirport,
      arr: arrAirport,
    },
  };
}

/** 여행 시작일 기준 며칠째인지(1부터 시작) — 여행 기간 밖이면 null */
export function dayIndexForDate(dateIso: string, tripStartDate: string, totalDays: number): number | null {
  const idx = daysBetween(tripStartDate, dateIso) + 1;
  return idx >= 1 && idx <= totalDays ? idx : null;
}
