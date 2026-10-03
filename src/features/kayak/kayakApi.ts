/**
 * Kayak 항공·호텔 검색 클라이언트 — 서버(/api/partnerProducts?provider=kayak, api/_lib/kayak)를 부른다.
 * Kayak 키는 서버에만 있고 앱에는 내려오지 않는다. 키가 서버에 없으면 503 → KayakUnavailableError → 화면은 '준비 중' 안내.
 */
import { apiUrl } from '@/shared/api/apiUrl';

export class KayakUnavailableError extends Error {
  constructor() {
    super('kayak not configured');
    this.name = 'KayakUnavailableError';
  }
}

const UID_KEY = 'triptic-kayak-uid';

/** Kayak이 요구하는 사용자별 고유 식별자(UUID) — 이 기기에 하나 만들어 둔다. 개인 정보가 아니다 */
export function kayakUid(): string {
  try {
    let id = localStorage.getItem(UID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(UID_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export async function kayakGet<T>(params: Record<string, string | number | null | undefined>, signal?: AbortSignal): Promise<T> {
  const q = new URLSearchParams({ provider: 'kayak', uid: kayakUid() });
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== '') q.set(k, String(v));
  const res = await fetch(apiUrl(`/api/partnerProducts?${q.toString()}`), { signal });
  if (res.status === 503) throw new KayakUnavailableError();
  if (!res.ok) throw new Error(`kayak HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** 표시 언어 → 호텔 언어 코드(서버 허용값) */
export function kayakLang(language: string): 'ko' | 'en' | 'ja' | 'zh-TW' {
  if (language.startsWith('ko')) return 'ko';
  if (language.startsWith('ja')) return 'ja';
  if (language.startsWith('zh')) return 'zh-TW';
  return 'en';
}

const LOCALE_CURRENCY = { ko: 'KRW', ja: 'JPY', 'zh-TW': 'TWD', en: 'USD' } as const;

/** 가격 통화 — 설정의 기본 통화가 있으면 그것, 없으면 표시 언어에 맞춰 */
export function kayakCurrency(baseCurrency: string | null | undefined, language: string): string {
  return baseCurrency && /^[A-Z]{3}$/.test(baseCurrency) ? baseCurrency : LOCALE_CURRENCY[kayakLang(language)];
}

export function formatMoney(amount: number, currency: string, language: string): string {
  try {
    return new Intl.NumberFormat(language, { style: 'currency', currency, maximumFractionDigits: amount >= 100 ? 0 : 2 }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount)}`;
  }
}

/** 외부 예약 페이지로 — 새 탭, 추천인 정보 없이, 제휴 링크 표시 */
export const EXTERNAL_LINK_PROPS = { target: '_blank', rel: 'sponsored noopener noreferrer' } as const;

// ───────── 자동완성 ─────────
export interface FlightPlaceItem {
  code: string;
  type: 'city' | 'airport';
  name: string;
  detail: string | null;
}

export interface HotelPlaceItem {
  key: string;
  kind: string;
  name: string;
  detail: string | null;
}

export function fetchFlightPlaces(q: string, signal?: AbortSignal): Promise<{ items: FlightPlaceItem[] }> {
  return kayakGet({ kind: 'place', type: 'flights', q }, signal);
}

export function fetchHotelPlaces(q: string, signal?: AbortSignal): Promise<{ items: HotelPlaceItem[] }> {
  return kayakGet({ kind: 'place', type: 'hotels', q }, signal);
}

// ───────── 항공 ─────────
export interface KayakSegment {
  airline: string;
  airlineName: string;
  airlineLogo: string | null;
  flightNumber: string;
  origin: string;
  destination: string;
  depart: string;
  arrive: string;
}

export interface KayakFlightLeg {
  depart: string;
  arrive: string;
  minutes: number;
  origin: string;
  destination: string;
  stops: number;
  via: string[];
  segments: KayakSegment[];
}

export interface KayakFlightOption {
  price: number;
  providerCode: string;
  providerName: string;
  providerLogo: string | null;
  bookingUrl: string;
  fare: string | null;
  carryOn: string | null;
  checked: string | null;
  freeCancel: boolean;
}

export interface KayakFlightOffer {
  id: string;
  price: number;
  options: KayakFlightOption[];
  legs: KayakFlightLeg[];
}

export interface KayakFlightsResponse {
  status: 'first-phase' | 'second-phase' | 'complete';
  searchId: string | null;
  cluster: string | null;
  total: number;
  currency: string;
  places: Record<string, string>;
  offers: KayakFlightOffer[];
  sandbox: boolean;
}

export type FlightSort = 'best' | 'price' | 'duration';

export interface KayakFlightQuery {
  origin: string;
  destination: string;
  depart: string;
  return: string | null;
  adults: number;
  children: number;
  infants: number;
  cabin: string;
  currency: string;
  sort: FlightSort;
  stops: number | null;
}

export function fetchFlights(query: KayakFlightQuery, cont: { searchId: string; cluster: string } | null, signal?: AbortSignal): Promise<KayakFlightsResponse> {
  return kayakGet(
    {
      kind: 'flights',
      currency: query.currency,
      sort: query.sort,
      stops: query.stops,
      ...(cont
        ? { searchId: cont.searchId, cluster: cont.cluster }
        : { origin: query.origin, destination: query.destination, depart: query.depart, return: query.return, adults: query.adults, children: query.children, infants: query.infants, cabin: query.cabin }),
    },
    signal,
  );
}

// ───────── 호텔 ─────────
export interface KayakHotelRate {
  room: string;
  total: number;
  freeCancel: boolean;
  payLater: boolean;
  breakfast: boolean;
  provider: string;
  providerLogo: string | null;
  url: string;
}

export interface KayakHotel {
  id: number;
  name: string;
  address: string;
  stars: number;
  selfRated: boolean;
  guestRating: number | null;
  reviews: number | null;
  distanceM: number | null;
  images: string[];
  lowest: number;
  nights: number;
  freeCancel: boolean;
  rates: KayakHotelRate[];
}

export interface HotelFilterOption {
  id: number;
  name: string;
  count: number;
}

export interface KayakHotelsResponse {
  complete: boolean;
  total: number;
  currency: string;
  nights: number;
  page: number;
  hasMore: boolean;
  hotels: KayakHotel[];
  filters: {
    priceMin: number | null;
    priceMax: number | null;
    stars: { key: number; count: number }[];
    propertyTypes: HotelFilterOption[];
    facilities: HotelFilterOption[];
  };
  sandbox: boolean;
}

export type HotelSort = 'popularity' | 'price' | 'rating' | 'stars' | 'distance';

export interface HotelQuery {
  destination: string;
  checkin: string;
  checkout: string;
  adults: number;
  rooms: number;
  childAges: number[];
  currency: string;
  lang: string;
  sort: HotelSort;
  stars: number[];
  guestRating: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  propertyTypes: number[];
  facilities: number[];
}

export function fetchHotels(query: HotelQuery, page: number, signal?: AbortSignal): Promise<KayakHotelsResponse> {
  return kayakGet(
    {
      kind: 'hotels',
      destination: query.destination,
      checkin: query.checkin,
      checkout: query.checkout,
      adults: query.adults,
      rooms: query.rooms,
      childAges: query.childAges.join('|'),
      currency: query.currency,
      lang: query.lang,
      sort: query.sort,
      stars: query.stars.join('|'),
      guestRating: query.guestRating,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      propertyTypes: query.propertyTypes.join('|'),
      facilities: query.facilities.join('|'),
      page,
    },
    signal,
  );
}
