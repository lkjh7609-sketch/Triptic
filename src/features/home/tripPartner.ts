import { normalizeLocale, type SupportedLocale } from '@/shared/i18n';

/**
 * 트립닷컴 제휴 — 호텔 화면 검색창이 여는 트립닷컴 호텔 검색 결과 주소.
 * 아래 값은 파트너 센터 "링크 만들기(Custom Link)"가 트립닷컴 검색 주소 끝에 붙여 준 그대로다
 * (Allianceid·SID는 계정, trip_sub1은 링크가 놓인 자리, trip_sub3은 그 링크의 표시). 정산 화면에서
 * 어느 링크에서 왔는지 볼 때 쓰이니 바꾸지 않는다.
 */
const ALLIANCE_ID = '10792895';
const SID = '332524291';
const SUB1 = 'home_hotels';
const SUB3 = 'D20018770';

/**
 * 앱 표시 언어 → 그 언어로 뜨는 트립닷컴 지역 사이트(ko 한국어 / www 영어 / jp 일본어 / tw 번체 중국어).
 * ⚠️ 한국어(kr) 외에는 실제 화면으로 확인하지 못했다(트립닷컴이 자동 접속을 인증 화면으로 막는다).
 */
const TRIP_HOST: Record<SupportedLocale, string> = {
  ko: 'kr.trip.com',
  en: 'www.trip.com',
  ja: 'jp.trip.com',
  'zh-TW': 'tw.trip.com',
};

/** 트립닷컴 호텔 검색 첫 화면(제휴 값만 붙임) — 우리 목록에 없는 지역·호텔 이름은 여기서 직접 찾게 한다 */
export function tripHotelsHomeUrl(locale: string): string {
  const host = TRIP_HOST[normalizeLocale(locale)];
  const params = new URLSearchParams({ Allianceid: ALLIANCE_ID, SID, trip_sub1: SUB1, trip_sub3: SUB3 });
  return `https://${host}/hotels/?${params.toString()}`;
}

/** 호텔 화면 검색창 아래의 추천 호텔 배너 3개(300×250) — 파트너 센터에서 하나씩 만든 코드, 링크 자리 표시는 카드마다 다르다 */
export const TRIP_HOTEL_CARDS = [
  { code: 'DB20019386', sub1: 'home_hotels_card1' }, // 서울
  { code: 'DB20019407', sub1: 'home_hotels_card2' }, // 서울
  { code: 'DB20019414', sub1: 'home_hotels_card3' }, // 도쿄
] as const;

export const TRIP_CARD_SIZE = { width: 300, height: 250 } as const;

/**
 * 추천 호텔 배너 iframe 주소 — 표시 언어의 지역 사이트로(검색창과 같은 규칙).
 * ⚠️ 한국어(kr)로 만든 코드라 다른 지역 사이트에서도 뜨는지는 확인하지 못했다.
 */
export function tripHotelCardSrc(card: (typeof TRIP_HOTEL_CARDS)[number], locale: string): string {
  const host = TRIP_HOST[normalizeLocale(locale)];
  const params = new URLSearchParams({ Allianceid: ALLIANCE_ID, SID, trip_sub1: card.sub1 });
  return `https://${host}/partners/ad/${card.code}?${params.toString()}`;
}

export interface TripHotelSearch {
  /** 트립닷컴 도시 번호(tripHotelCities.ts) */
  cityId: number;
  /** 표시 언어로 된 도시 이름 — 트립닷컴 검색창에 그대로 보인다 */
  cityName: string;
  /** YYYY-MM-DD */
  checkIn: string;
  checkOut: string;
  adults: number;
  rooms: number;
}

/**
 * 트립닷컴 호텔 검색 결과 주소 — 트립닷컴 검색창이 만든 주소(hotels/list?city=228&…)에서 검색이 정하는 것만 넣는다.
 * 도시별·계정별로 달라지는 값(countryId, searchValue, 좌표, 통화 등)은 일부러 빼서 100개 도시에 짐작으로 채우지
 * 않는다 — 통화는 각 지역 사이트 기본값을 따른다. 어린이는 나이(ages) 형식을 몰라 v1에서는 받지 않는다.
 */
export function tripHotelSearchUrl(search: TripHotelSearch, locale: string): string {
  const host = TRIP_HOST[normalizeLocale(locale)];
  const params = new URLSearchParams({
    city: String(search.cityId),
    cityName: search.cityName,
    searchType: 'CT',
    searchWord: search.cityName,
    checkIn: search.checkIn,
    checkOut: search.checkOut,
    crn: String(search.rooms),
    adult: String(search.adults),
    children: '0',
    Allianceid: ALLIANCE_ID,
    SID,
    trip_sub1: SUB1,
    trip_sub3: SUB3,
  });
  return `https://${host}/hotels/list?${params.toString()}`;
}
