import { addDays, format } from 'date-fns';

/** 호텔 검색 조건 — 주소(?dest=…)에 담아 새로고침·공유해도 같은 검색이 나온다 */
export interface HotelSearch {
  /** Kayak entityKey (kplace:22327) */
  destination: string;
  /** 화면에 보이는 이름 */
  name: string;
  checkin: string;
  checkout: string;
  adults: number;
  rooms: number;
  childAges: number[];
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const ENTITY = /^k(place|hotel):\d+$/;

export const MAX_ROOMS = 4;
export const MAX_ADULTS = 8;
export const MAX_CHILDREN = 4;

export function defaultDates(): { checkin: string; checkout: string } {
  const start = addDays(new Date(), 14);
  return { checkin: format(start, 'yyyy-MM-dd'), checkout: format(addDays(start, 2), 'yyyy-MM-dd') };
}

export function nightsBetween(checkin: string, checkout: string): number {
  return Math.max(1, Math.round((Date.parse(checkout) - Date.parse(checkin)) / 86_400_000));
}

/** 주소 → 검색 조건. 목적지가 없거나 틀리면 null(아직 검색 전) */
export function parseHotelSearch(params: URLSearchParams): HotelSearch | null {
  const destination = params.get('dest') ?? '';
  const checkin = params.get('checkin') ?? '';
  const checkout = params.get('checkout') ?? '';
  if (!ENTITY.test(destination) || !YMD.test(checkin) || !YMD.test(checkout) || checkout <= checkin) return null;
  const rooms = Math.min(Math.max(Number(params.get('rooms')) || 1, 1), MAX_ROOMS);
  const adults = Math.min(Math.max(Number(params.get('adults')) || 2, rooms), MAX_ADULTS);
  const childAges = (params.get('ages') ?? '')
    .split('|')
    .filter(Boolean)
    .map(Number)
    .filter((a) => Number.isInteger(a) && a >= 0 && a <= 17)
    .slice(0, MAX_CHILDREN);
  return { destination, name: (params.get('name') ?? '').slice(0, 80), checkin, checkout, adults, rooms, childAges };
}

export function hotelSearchParams(s: HotelSearch): URLSearchParams {
  const p = new URLSearchParams({ dest: s.destination, name: s.name, checkin: s.checkin, checkout: s.checkout, adults: String(s.adults), rooms: String(s.rooms) });
  if (s.childAges.length) p.set('ages', s.childAges.join('|'));
  return p;
}
