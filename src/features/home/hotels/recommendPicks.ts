import { addDays, format, parseISO } from 'date-fns';
import type { TripRow } from '@/shared/api/tripService';
import type { Destination } from '@/features/community/types';
import { nightsBetween } from './hotelSearch';

/** 호텔 검색 아래 추천 여행지 한 칸 */
export interface RecommendedItem {
  key: string;
  name: string;
  lat: number;
  lng: number;
  /** 대표 사진 — 없으면 화면이 도시 이름으로 찾는다 */
  cover: string | null;
  /** 내 일정의 도시면 그 여행 날짜(오늘 이후로 맞춘 것) — 인기 도시는 null */
  dates: { checkin: string; checkout: string } | null;
  fromTrip: boolean;
}

export const MAX_RECOMMENDED = 6;
/** 같은 도시로 보는 거리(도) — 좌표가 조금 달라도 한 칸으로 */
const SAME_PLACE_DEG = 0.25;
const MAX_NIGHTS = 30;

const samePlace = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => Math.abs(a.lat - b.lat) < SAME_PLACE_DEG && Math.abs(a.lng - b.lng) < SAME_PLACE_DEG;

/** 여행 날짜를 호텔 검색에 쓸 수 있게 — 이미 떠났으면 오늘부터, 체크아웃은 체크인 다음 날 이후, 30박까지 */
export function tripSearchDates(trip: Pick<TripRow, 'start_date' | 'end_date'>, today: string): { checkin: string; checkout: string } | null {
  if (!trip.start_date) return null;
  const end = trip.end_date ?? trip.start_date;
  if (end < today) return null;
  const checkin = trip.start_date < today ? today : trip.start_date;
  let checkout = end > checkin ? end : format(addDays(parseISO(checkin), 1), 'yyyy-MM-dd');
  if (nightsBetween(checkin, checkout) > MAX_NIGHTS) checkout = format(addDays(parseISO(checkin), MAX_NIGHTS), 'yyyy-MM-dd');
  return { checkin, checkout };
}

/**
 * 추천 여행지 — 내 일정의 도시(가까운 여행 순)를 먼저, 모자라면 인기 도시(is_featured, 정렬 순)로 채운다. 같은 도시는 한 번만.
 * @param cityName 여행 도시 표시 이름 만들기(예: cityDisplayName)
 */
export function recommendedDestinations(
  trips: TripRow[],
  destinations: Destination[],
  today: string,
  cityName: (city: string) => string,
  limit = MAX_RECOMMENDED,
): RecommendedItem[] {
  const items: RecommendedItem[] = [];
  const add = (item: RecommendedItem) => {
    if (items.length < limit && !items.some((i) => samePlace(i, item))) items.push(item);
  };

  const upcoming = trips
    .filter((t) => t.status !== 'archived' && t.city && t.city_lat !== null && t.city_lng !== null && tripSearchDates(t, today))
    .sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''));
  for (const t of upcoming) {
    add({ key: `trip:${t.id}`, name: cityName(t.city!), lat: t.city_lat!, lng: t.city_lng!, cover: null, dates: tripSearchDates(t, today), fromTrip: true });
  }

  const popular = destinations
    .filter((d) => d.is_featured)
    .sort((a, b) => a.sort_order - b.sort_order);
  for (const d of popular) add({ key: `dest:${d.slug}`, name: d.name, lat: d.lat, lng: d.lng, cover: d.cover_url, dates: null, fromTrip: false });
  return items;
}
