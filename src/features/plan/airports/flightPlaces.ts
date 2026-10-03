/* i18n-exempt-file: 공항 여럿인 도시 이름 데이터 — 4개 언어 이름을 직접 담는다(airports 표의 name·city와 같은 방식) */
/**
 * 항공권 검색의 출발지·도착지(도시 코드 SEL / 공항 코드 ICN) — 우리 공항 목록(airports 표, 0079)에서 찾는다.
 * 예전엔 트래블페이아웃의 무료 자동완성(places2)·접속 위치(whereami)를 썼는데 트래블페이아웃을 뺐다(2026-10-04).
 * 공항이 여럿인 도시는 마이리얼트립 검색이 도시 코드(C.SEL)로 모든 공항을 함께 찾으므로, 그런 도시만 아래 표로 따로 둔다.
 */
import { haversineKm } from '../map/geo';
import { normalizeQuery, pickName, searchAirports, type Airport, type LocaleNames } from './airportData';

export interface FlightPlace {
  code: string;
  type: 'city' | 'airport';
  name: string;
  detail: string | null;
}

interface MetroCity {
  code: string;
  country: string;
  airports: string[];
  names: LocaleNames;
}

/** 공항이 둘 이상인 주요 도시(IATA 도시 코드). 목록에 공항이 둘 이상 있을 때만 '모든 공항'으로 보인다 */
export const METRO_CITIES: readonly MetroCity[] = [
  { code: 'SEL', country: 'KR', airports: ['ICN', 'GMP'], names: { ko: '서울', en: 'Seoul', ja: 'ソウル', 'zh-TW': '首爾' } },
  { code: 'TYO', country: 'JP', airports: ['NRT', 'HND'], names: { ko: '도쿄', en: 'Tokyo', ja: '東京', 'zh-TW': '東京' } },
  { code: 'OSA', country: 'JP', airports: ['KIX', 'ITM', 'UKB'], names: { ko: '오사카', en: 'Osaka', ja: '大阪', 'zh-TW': '大阪' } },
  { code: 'TPE', country: 'TW', airports: ['TPE', 'TSA'], names: { ko: '타이베이', en: 'Taipei', ja: '台北', 'zh-TW': '台北' } },
  { code: 'SHA', country: 'CN', airports: ['PVG', 'SHA'], names: { ko: '상하이', en: 'Shanghai', ja: '上海', 'zh-TW': '上海' } },
  { code: 'BJS', country: 'CN', airports: ['PEK', 'PKX'], names: { ko: '베이징', en: 'Beijing', ja: '北京', 'zh-TW': '北京' } },
  { code: 'BKK', country: 'TH', airports: ['BKK', 'DMK'], names: { ko: '방콕', en: 'Bangkok', ja: 'バンコク', 'zh-TW': '曼谷' } },
  { code: 'JKT', country: 'ID', airports: ['CGK', 'HLP'], names: { ko: '자카르타', en: 'Jakarta', ja: 'ジャカルタ', 'zh-TW': '雅加達' } },
  { code: 'LON', country: 'GB', airports: ['LHR', 'LGW', 'STN', 'LTN', 'LCY'], names: { ko: '런던', en: 'London', ja: 'ロンドン', 'zh-TW': '倫敦' } },
  { code: 'PAR', country: 'FR', airports: ['CDG', 'ORY'], names: { ko: '파리', en: 'Paris', ja: 'パリ', 'zh-TW': '巴黎' } },
  { code: 'ROM', country: 'IT', airports: ['FCO', 'CIA'], names: { ko: '로마', en: 'Rome', ja: 'ローマ', 'zh-TW': '羅馬' } },
  { code: 'MIL', country: 'IT', airports: ['MXP', 'LIN', 'BGY'], names: { ko: '밀라노', en: 'Milan', ja: 'ミラノ', 'zh-TW': '米蘭' } },
  { code: 'NYC', country: 'US', airports: ['JFK', 'EWR', 'LGA'], names: { ko: '뉴욕', en: 'New York', ja: 'ニューヨーク', 'zh-TW': '紐約' } },
];

function metroCitiesIn(airports: readonly Airport[]): MetroCity[] {
  const have = new Set(airports.map((a) => a.iata));
  return METRO_CITIES.filter((m) => m.airports.filter((code) => have.has(code)).length >= 2);
}

function cityPlace(m: MetroCity, language: string, countryName: (code: string) => string): FlightPlace {
  return { code: m.code, type: 'city', name: pickName(m.names, language), detail: countryName(m.country) };
}

function airportPlace(a: Airport, language: string, countryName: (code: string) => string): FlightPlace {
  const city = pickName(a.city, language);
  return {
    code: a.iata,
    type: 'airport',
    name: pickName(a.name, language) || city || a.iata,
    detail: [city, countryName(a.country_code)].filter(Boolean).join(', ') || null,
  };
}

/** 입력한 글자로 출발지·도착지 후보 — 공항이 여럿인 도시('모든 공항')가 먼저, 그다음 공항 */
export function searchFlightPlaces(
  airports: readonly Airport[],
  query: string,
  language: string,
  countryName: (code: string) => string = (code) => code,
  limit = 8,
): FlightPlace[] {
  const q = normalizeQuery(query);
  if (!q) return [];
  const cities = metroCitiesIn(airports)
    .filter((m) => m.code.toLowerCase() === q || Object.values(m.names).some((n) => n && normalizeQuery(n).startsWith(q)))
    .map((m) => cityPlace(m, language, countryName));
  const rest = searchAirports(airports, query, { countryName, limit }).map((a) => airportPlace(a, language, countryName));
  return [...cities, ...rest].slice(0, limit);
}

/** 코드(주소로 넘어온 SEL·ICN)를 이름이 붙은 출발지·도착지로. 목록에 없으면 null */
export function flightPlaceForCode(
  airports: readonly Airport[],
  code: string,
  language: string,
  countryName: (code: string) => string = (c) => c,
): FlightPlace | null {
  const upper = code.toUpperCase();
  const metro = metroCitiesIn(airports).find((m) => m.code === upper);
  if (metro) return cityPlace(metro, language, countryName);
  const airport = airports.find((a) => a.iata === upper);
  return airport ? airportPlace(airport, language, countryName) : null;
}

/** 한국어 항공 검색의 기본 출발지 — 서울(인천·김포 모두) */
export const DEFAULT_ORIGIN_CODE = 'SEL';

/**
 * 여행지 좌표 → 가장 가까운 공항(150km 안). 그 공항이 공항 여럿인 도시에 속하면 도시 코드로(도쿄 → TYO).
 * 좌표가 없으면 도시 이름으로 찾은 첫 공항. 못 찾으면 null.
 */
export function flightPlaceForTrip(
  airports: readonly Airport[],
  trip: { city: string | null; city_lat: number | null; city_lng: number | null },
): { code: string; type: FlightPlace['type'] } | null {
  let airport: Airport | undefined;
  if (trip.city_lat != null && trip.city_lng != null) {
    let best: { a: Airport; km: number } | undefined;
    for (const a of airports) {
      const km = haversineKm(trip.city_lat, trip.city_lng, a.lat, a.lng);
      if (km <= 150 && (!best || km < best.km)) best = { a, km };
    }
    airport = best?.a;
  } else if (trip.city) {
    airport = searchAirports(airports, trip.city.split(',')[0], { limit: 1 })[0];
  }
  if (!airport) return null;
  const metro = metroCitiesIn(airports).find((m) => m.airports.includes(airport.iata));
  return metro ? { code: metro.code, type: 'city' } : { code: airport.iata, type: 'airport' };
}
