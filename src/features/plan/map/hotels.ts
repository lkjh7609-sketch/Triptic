/**
 * 숙소 상속 로직 (index.html에서 이식 — ADR-001)
 * 원본: index.html getEffectiveHotel/getDayHotels (2026-09-20 기준 라인 5957~5969)
 *
 * 전역 변수(hotelsData, totalTripDays) 의존을 인자로 바꾼 것 외에 알고리즘은
 * 원본과 동일하다: 숙소가 지정 안 된 날은 가장 최근에 지정된 이전 날짜의 숙소를
 * 그대로 물려받는다(체크인만 하고 여러 밤 묵는 경우를 표현).
 */

export interface Hotel {
  name: string;
  address?: string;
  lat: number;
  lng: number;
}

/**
 * day 시점에 "적용 중인" 숙소를 찾는다 — day부터 1까지 역순으로 가장 먼저
 * 발견되는, 이름이 있는 숙소를 반환한다 (원본 getEffectiveHotel).
 */
export function getEffectiveHotel(
  day: number,
  hotelsByDay: Record<number, Hotel | undefined>,
): Hotel | null {
  for (let d = day; d >= 1; d--) {
    const h = hotelsByDay[d];
    if (h && h.name) return h;
  }
  return null;
}

/**
 * 그 날 경로의 출발점(startHotel, 전날 숙소)과 도착점(endHotel, 당일 숙소)을
 * 계산한다 (원본 getDayHotels). 마지막 날은 다음날 이동이 없으므로 endHotel이 없다.
 */
export function getDayHotels(
  day: number,
  totalTripDays: number,
  hotelsByDay: Record<number, Hotel | undefined>,
): { startHotel: Hotel | null; endHotel: Hotel | null } {
  const isLastDay = day >= totalTripDays;
  const endHotel = isLastDay ? null : getEffectiveHotel(day, hotelsByDay);
  const startHotel = day > 1 ? getEffectiveHotel(day - 1, hotelsByDay) : null;
  return { startHotel, endHotel };
}
