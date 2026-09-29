import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { Destination } from '@/features/community/types';
import { haversineKm } from '@/features/plan/map/geo';
import { TRIP_HOTEL_CITY_IDS } from './tripHotelCities';

/** 트립닷컴 도시 번호가 있는 여행지만 — 없으면 검색 결과를 열 방법이 없다 */
export function hotelDestinations(all: readonly Destination[]): Destination[] {
  return all.filter((d) => TRIP_HOTEL_CITY_IDS[d.slug] !== undefined);
}

/**
 * 여행지 검색 — 이름·주소(slug)·나라 이름에 글자가 들어 있으면 찾는다(이름이 그 글자로 시작하는 것을 먼저).
 * 비어 있으면 추천 여행지부터 보여 준다.
 */
export function matchDestinations(
  list: readonly Destination[],
  query: string,
  countryName: (countryCode: string) => string,
  limit = 8,
): Destination[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return [...list].sort((a, b) => Number(b.is_featured) - Number(a.is_featured) || a.sort_order - b.sort_order).slice(0, limit);
  }
  const scored: { dest: Destination; score: number }[] = [];
  for (const dest of list) {
    const name = dest.name.toLowerCase();
    if (name.startsWith(q)) scored.push({ dest, score: 0 });
    else if (name.includes(q)) scored.push({ dest, score: 1 });
    else if (dest.slug.includes(q) || countryName(dest.country_code).toLowerCase().includes(q)) scored.push({ dest, score: 2 });
  }
  return scored.sort((a, b) => a.score - b.score || a.dest.sort_order - b.dest.sort_order).slice(0, limit).map((s) => s.dest);
}

/** 좌표에서 maxKm 안에 있는 가장 가까운 여행지(다음 여행 도시를 검색창에 미리 채울 때) */
export function nearestDestination(list: readonly Destination[], lat: number, lng: number, maxKm = 50): Destination | null {
  let best: Destination | null = null;
  let bestKm = maxKm;
  for (const dest of list) {
    const km = haversineKm(lat, lng, dest.lat, dest.lng);
    if (km <= bestKm) {
      best = dest;
      bestKm = km;
    }
  }
  return best;
}

/** 체크인~체크아웃 박 수(YYYY-MM-DD 두 개). 체크아웃이 아직 안 골라졌으면 0 */
export function nightsBetween(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  return Math.max(0, differenceInCalendarDays(parseISO(checkOut), parseISO(checkIn)));
}
