import { addDays, format } from 'date-fns';

/** 호텔 검색 조건 — 주소(?name=…&lat=…&lng=…)에 담아 새로고침·공유해도 같은 검색이 나온다 */
export interface HotelSearch {
  /** 화면에 보이는 이름 */
  name: string;
  /** 구글 자동완성이 준 좌표 — 서버가 이 좌표에서 가장 가까운 도시를 찾는다 */
  lat: number;
  lng: number;
  checkin: string;
  checkout: string;
  adults: number;
  childAges: number[];
  /** 호텔 이름으로 고른 검색이면 그 호텔(아고다 ID) — 결과 맨 위에 고정하고 같은 도시 추천을 아래에 */
  hotelId?: number;
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export const MAX_ADULTS = 8;
export const MAX_CHILDREN = 4;

export function defaultDates(): { checkin: string; checkout: string } {
  const start = addDays(new Date(), 14);
  return { checkin: format(start, 'yyyy-MM-dd'), checkout: format(addDays(start, 2), 'yyyy-MM-dd') };
}

export function nightsBetween(checkin: string, checkout: string): number {
  return Math.max(1, Math.round((Date.parse(checkout) - Date.parse(checkin)) / 86_400_000));
}

function coordinate(value: string | null, limit: number): number | null {
  if (value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

/** 주소 → 검색 조건. 좌표나 날짜가 없거나 틀리면 null(아직 검색 전) */
export function parseHotelSearch(params: URLSearchParams): HotelSearch | null {
  const lat = coordinate(params.get('lat'), 90);
  const lng = coordinate(params.get('lng'), 180);
  const checkin = params.get('checkin') ?? '';
  const checkout = params.get('checkout') ?? '';
  if (lat === null || lng === null || !YMD.test(checkin) || !YMD.test(checkout) || checkout <= checkin) return null;
  const adults = Math.min(Math.max(Number(params.get('adults')) || 2, 1), MAX_ADULTS);
  const childAges = (params.get('ages') ?? '')
    .split('|')
    .filter(Boolean)
    .map(Number)
    .filter((a) => Number.isInteger(a) && a >= 0 && a <= 17)
    .slice(0, MAX_CHILDREN);
  const hotelId = Number(params.get('hotel'));
  return {
    name: (params.get('name') ?? '').slice(0, 80),
    lat,
    lng,
    checkin,
    checkout,
    adults,
    childAges,
    ...(Number.isInteger(hotelId) && hotelId > 0 ? { hotelId } : {}),
  };
}

export function hotelSearchParams(s: HotelSearch): URLSearchParams {
  const p = new URLSearchParams({
    name: s.name,
    lat: String(s.lat),
    lng: String(s.lng),
    checkin: s.checkin,
    checkout: s.checkout,
    adults: String(s.adults),
  });
  if (s.childAges.length) p.set('ages', s.childAges.join('|'));
  if (s.hotelId) p.set('hotel', String(s.hotelId));
  return p;
}
