/**
 * 확정된 예약을 실제 여행 콘텐츠(LocalProject)에 반영한다 (04-document-ai.md §9 "일정 반영 규칙")
 *
 * ⚠️ 스펙 §9 원문은 정규화 테이블(itinerary_items)에 항목을 만드는 걸 전제하지만,
 * ADR-002 M7 컷오버(2026-09-21) 이후에도 화면의 편집 모델은 여전히 LocalProject
 * 모양(data/hotels/meals/flights)이다(tripService.ts가 정규화 테이블을 이
 * 모양으로 재구성해줄 뿐 — src/features/plan/itineraryTransform.ts 참고).
 * itinerary_items에 직접 써봐야 이 화면 렌더링 경로엔 안 보이므로, 여전히
 * LocalProject 슬롯(flights/hotels/data)에 맞춰 넣는다.
 *
 * 항공편은 공항 DB에서 좌표를 이미 채워뒀지만(validate.ts resolveFlightAirports),
 * 숙소/철도/렌터카/액티비티는 "장소명/주소" 텍스트만 있고 좌표가 없다(§7의
 * "호텔 좌표 → Google Places 해석"은 아직 구현 전) — 그래서 이 항목들은 커밋 시
 * 좌표가 필수인 기존 모달(SetHotelModal/AddPlaceModal)을 그대로 재사용해
 * 사용자가 정확한 장소를 검색·확정하게 한다(추출된 이름을 검색어로 미리 채움).
 * 이건 "조용한 자동 확정 금지"(§1) 원칙에도 더 맞는다 — 주소만으로 지오코딩하면
 * 같은 체인의 다른 지점을 잘못 고를 위험이 있다.
 */
import type { ParsedFlight } from './parseBooking/schema.ts';
import type { FlightAirportInfo, FlightInfo, FlightsData } from '../plan/types.ts';

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

export interface FlightSlotContext {
  /** 같은 문서에서 나온 다른 항공편(검수 대기 중이거나 방금 반영한 것) — 왕복·다구간이면 출발 순서로 칸을 정한다 */
  sameDocumentFlights?: ParsedFlight[];
  /** 이미 일정에 들어 있는 항공편 */
  existing?: FlightsData;
}

/**
 * outbound/return 칸 정하기.
 *  1) 같은 문서의 항공편이 여럿이면 출발 시각 순서 — 가장 먼저 뜨는 편 outbound, 마지막 편 return
 *     (여행 날짜와 상관없이 — 예전엔 여행 기간 밖의 왕복 항공권이 둘 다 outbound로 들어가 덮어썼다)
 *  2) 이미 한쪽만 있으면 그보다 뒤에 뜨면 return, 앞에 뜨면 outbound
 *  3) 그 밖엔 출발일이 여행 시작일에 더 가까우면 outbound, 도착일이 종료일에 더 가까우면 return
 */
function pickSlot(flight: ParsedFlight, dep: { date: string }, arr: { date: string }, tripStartDate: string, tripEndDate: string, ctx: FlightSlotContext): 'outbound' | 'return' {
  const depAt = flight.departure.scheduledLocal.value ?? '';
  const all = [flight, ...(ctx.sameDocumentFlights ?? [])].filter((f) => !!f.departure.scheduledLocal.value);
  if (all.length >= 2 && depAt) {
    const sorted = [...all].sort((a, b) => (a.departure.scheduledLocal.value ?? '').localeCompare(b.departure.scheduledLocal.value ?? ''));
    const idx = sorted.indexOf(flight);
    if (idx === 0) return 'outbound';
    if (idx === sorted.length - 1) return 'return';
    return idx < sorted.length / 2 ? 'outbound' : 'return';
  }
  const existing = ctx.existing;
  if (existing?.outbound && !existing.return && dep.date >= existing.outbound.date) return 'return';
  if (existing?.return && !existing.outbound && dep.date <= existing.return.date) return 'outbound';

  const distToStart = Math.abs(daysBetween(tripStartDate, dep.date));
  const distToEnd = Math.abs(daysBetween(arr.date, tripEndDate));
  return distToStart <= distToEnd ? 'outbound' : 'return';
}

/** ParsedFlight → FlightInfo 변환 + outbound/return 칸 판정(pickSlot) */
export function commitFlightBooking(
  flight: ParsedFlight,
  tripStartDate: string,
  tripEndDate: string,
  ctx: FlightSlotContext = {},
): FlightCommitResult | null {
  const dep = splitLocal(flight.departure.scheduledLocal.value);
  const arr = splitLocal(flight.arrival.scheduledLocal.value);
  if (!dep || !arr || !flight.departure.airportIata.value || !flight.arrival.airportIata.value) return null;

  const slot = pickSlot(flight, dep, arr, tripStartDate, tripEndDate, ctx);

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
