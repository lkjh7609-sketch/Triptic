/**
 * 호텔 검색 클라이언트 — 서버(/api/partnerProducts?provider=agoda, api/_lib/agoda)를 부른다.
 * 제휴 키는 서버에만 있고 앱에는 내려오지 않는다. 키가 서버에 없으면 503 → HotelsUnavailableError → 화면은 '준비 중' 안내.
 */
import { apiUrl } from '@/shared/api/apiUrl';

export class HotelsUnavailableError extends Error {
  constructor() {
    super('hotels not configured');
    this.name = 'HotelsUnavailableError';
  }
}

export type HotelSort = 'recommended' | 'priceAsc' | 'priceDesc' | 'starsDesc' | 'reviewScore';
export const HOTEL_SORTS: HotelSort[] = ['recommended', 'priceAsc', 'priceDesc', 'starsDesc', 'reviewScore'];

export interface Hotel {
  id: string;
  name: string;
  stars: number;
  reviewScore: number | null;
  reviewCount: number | null;
  /** 1박 가격(검색 통화) */
  price: number;
  /** 할인 전 가격 — 없으면 null */
  crossedOut: number | null;
  discountPct: number | null;
  breakfast: boolean;
  wifi: boolean;
  image: string | null;
  lat: number | null;
  lng: number | null;
  /** 예약 페이지 — 받은 그대로 쓴다(바꾸면 제휴 추적이 끊긴다) */
  url: string;
}

export interface HotelsResponse {
  /** 검색한 도시 — 좌표 근처에 도시가 없으면 null */
  city: { id: number; name: string; country: string; distanceKm: number } | null;
  hotels: Hotel[];
  nights: number;
  currency: string;
}

export interface HotelQuery {
  lat: number;
  lng: number;
  checkin: string;
  checkout: string;
  adults: number;
  childAges: number[];
  currency: string;
  lang: 'ko' | 'en' | 'ja' | 'zh-TW';
  sort: HotelSort;
  minStars: number | null;
  minReview: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  discountOnly: boolean;
}

export async function fetchHotels(query: HotelQuery, signal?: AbortSignal): Promise<HotelsResponse> {
  const q = new URLSearchParams({
    provider: 'agoda',
    kind: 'hotels',
    lat: String(query.lat),
    lng: String(query.lng),
    checkin: query.checkin,
    checkout: query.checkout,
    adults: String(query.adults),
    currency: query.currency,
    lang: query.lang,
    sort: query.sort,
  });
  if (query.childAges.length) q.set('childAges', query.childAges.join('|'));
  if (query.minStars) q.set('minStars', String(query.minStars));
  if (query.minReview) q.set('minReview', String(query.minReview));
  if (query.minPrice !== null) q.set('minPrice', String(query.minPrice));
  if (query.maxPrice !== null) q.set('maxPrice', String(query.maxPrice));
  if (query.discountOnly) q.set('discountOnly', '1');
  const res = await fetch(apiUrl(`/api/partnerProducts?${q.toString()}`), { signal });
  if (res.status === 503) throw new HotelsUnavailableError();
  if (!res.ok) throw new Error(`hotels HTTP ${res.status}`);
  return (await res.json()) as HotelsResponse;
}

/** 표시 언어 → 호텔 검색 언어(서버 허용값) */
export function hotelLang(language: string): HotelQuery['lang'] {
  if (language.startsWith('ko')) return 'ko';
  if (language.startsWith('ja')) return 'ja';
  if (language.startsWith('zh')) return 'zh-TW';
  return 'en';
}

const LOCALE_CURRENCY = { ko: 'KRW', ja: 'JPY', 'zh-TW': 'TWD', en: 'USD' } as const;
/** 서버가 받는 통화(api/_lib/agoda/hotels.js CURRENCIES와 같아야 한다) */
const SUPPORTED_CURRENCIES = new Set(['KRW', 'USD', 'JPY', 'TWD', 'EUR', 'GBP', 'CNY', 'HKD', 'SGD', 'THB', 'VND', 'AUD']);

/** 가격 통화 — 설정의 기본 통화가 지원되는 것이면 그것, 아니면 표시 언어에 맞춰 */
export function hotelCurrency(baseCurrency: string | null | undefined, language: string): string {
  return baseCurrency && SUPPORTED_CURRENCIES.has(baseCurrency) ? baseCurrency : LOCALE_CURRENCY[hotelLang(language)];
}

export function formatMoney(amount: number, currency: string, language: string): string {
  try {
    return new Intl.NumberFormat(language, { style: 'currency', currency, maximumFractionDigits: amount >= 100 ? 0 : 2 }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount)}`;
  }
}
