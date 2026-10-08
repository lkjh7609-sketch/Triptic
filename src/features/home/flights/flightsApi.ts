/**
 * 항공 운임 검색 클라이언트 — 서버(/api/partnerProducts?provider=flights, api/_lib/flights)를 부른다.
 * 운임 데이터 키는 서버에만 있다. 키가 없거나 월 상한·상대 장애면 서버가 503/502와 함께 예약 사이트 검색 링크(bookingUrl)를
 * 주므로, 화면은 결과 대신 그 링크로 가는 안내를 보여 준다. 가격은 승객 전체 합계(perPerson은 한 명 몫 근사).
 */
import { apiUrl } from '@/shared/api/apiUrl';
import type { FlightSearch } from '@/features/plan/partnerLinks';

export interface FlightSegment {
  carrier: string;
  flightNo: string;
  origin: string;
  destination: string;
  depart: string;
  arrive: string;
  minutes: number;
}

export interface FlightLeg {
  carrier: { code: string; name: string };
  /** 현지 시각 2026-11-20T15:35:00 */
  depart: string;
  arrive: string;
  origin: string;
  destination: string;
  minutes: number;
  stops: number;
  via: string[];
  segments: FlightSegment[];
}

export interface FlightOffer {
  id: string;
  /** 승객 전체 합계 */
  price: number;
  perPerson: number;
  currency: string;
  /** 가격 확인됨(아니면 '대략') */
  verified: boolean;
  selfTransfer: boolean;
  legs: FlightLeg[];
}

export interface FlightsResponse {
  currency: string | null;
  offers: FlightOffer[];
  observedAt: string | null;
  /** 이 검색의 예약 사이트 링크 — 모든 카드가 같은 링크를 쓴다(노선·날짜·인원만 넘어간다) */
  bookingUrl: string;
  tracked: boolean;
}

/** 결과를 못 보여 주는 경우 — 안내와 함께 예약 사이트에서 직접 검색하는 링크를 준다 */
export class FlightsUnavailableError extends Error {
  readonly bookingUrl: string | null;
  constructor(bookingUrl: string | null) {
    super('flights unavailable');
    this.name = 'FlightsUnavailableError';
    this.bookingUrl = bookingUrl;
  }
}

/** 표시 언어 → 서버가 받는 언어(예약 사이트·가격 통화를 정한다) */
export function flightsLocale(language: string): 'ko' | 'en' | 'ja' | 'zh-TW' {
  if (language.startsWith('ko')) return 'ko';
  if (language.startsWith('ja')) return 'ja';
  if (language.startsWith('zh')) return 'zh-TW';
  return 'en';
}

/** 서버 쿼리 — 같은 검색은 같은 주소가 되도록 키 순서를 고정한다(CDN 캐시 적중) */
export function flightsQuery(search: FlightSearch, locale: string): string {
  const q = new URLSearchParams({
    provider: 'flights',
    kind: 'search',
    origin: search.origin,
    destination: search.destination,
    depart_date: search.departDate,
  });
  if (search.returnDate) q.set('return_date', search.returnDate);
  q.set('adults', String(search.adults));
  if (search.children) q.set('children', String(search.children));
  if (search.infants) q.set('infants', String(search.infants));
  if (search.cabin && search.cabin !== 'ECONOMY') q.set('cabin', search.cabin);
  q.set('locale', locale);
  return q.toString();
}

export async function fetchFlights(search: FlightSearch, language: string, signal?: AbortSignal): Promise<FlightsResponse> {
  const res = await fetch(apiUrl(`/api/partnerProducts?${flightsQuery(search, flightsLocale(language))}`), { signal });
  if (res.status === 503 || res.status === 502) {
    let bookingUrl: string | null = null;
    try {
      const body = (await res.json()) as { bookingUrl?: unknown };
      if (typeof body.bookingUrl === 'string') bookingUrl = body.bookingUrl;
    } catch {
      // 본문이 없으면 링크 없이 안내만
    }
    throw new FlightsUnavailableError(bookingUrl);
  }
  if (!res.ok) throw new Error(`flights HTTP ${res.status}`);
  return (await res.json()) as FlightsResponse;
}

export function formatMoney(amount: number, currency: string, language: string): string {
  try {
    return new Intl.NumberFormat(language, { style: 'currency', currency, maximumFractionDigits: amount >= 100 ? 0 : 2 }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount)}`;
  }
}
