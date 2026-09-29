import { normalizeLocale, type SupportedLocale } from '@/shared/i18n';

/**
 * 트립닷컴 제휴 — 호텔 화면의 검색 위젯과 추천 호텔 배너(파트너 센터에서 만든 iframe 코드).
 * 아이디는 iframe 주소로 브라우저에 그대로 보이는 공개 값이다. trip_sub1은 위젯·배너가 놓인 자리 표시로,
 * 정산 화면에서 어느 것에서 왔는지 볼 때 쓰이니 바꾸지 않는다.
 * (직접 만든 검색창 + 도시 번호 100곳 버전은 커밋 0fd0fec·14c26f9에 있다 — 다시 쓸 때 거기서 꺼낸다)
 */
const ALLIANCE_ID = '10792895';
const SID = '332524291';

/**
 * 앱 표시 언어 → 그 언어로 뜨는 트립닷컴 지역 사이트(ko 한국어 / www 영어 / jp 일본어 / tw 번체 중국어).
 * ⚠️ 한국어(kr) 외에는 위젯·배너가 그 언어로 뜨는지 확인하지 못했다(트립닷컴이 자동 접속을 인증 화면으로 막는다).
 */
const TRIP_HOST: Record<SupportedLocale, string> = {
  ko: 'kr.trip.com',
  en: 'www.trip.com',
  ja: 'jp.trip.com',
  'zh-TW': 'tw.trip.com',
};

interface TripAd {
  code: string;
  sub1: string;
}

/** 검색 위젯(세로형 430×645) */
export const TRIP_HOTEL_WIDGET: TripAd = { code: 'S20018532', sub1: 'home_hotels' };
export const TRIP_WIDGET_SIZE = { width: 430, height: 645 } as const;

/** 추천 호텔 배너 3개(300×250) — 서울, 서울, 도쿄 */
export const TRIP_HOTEL_CARDS: readonly TripAd[] = [
  { code: 'DB20019386', sub1: 'home_hotels_card1' },
  { code: 'DB20019407', sub1: 'home_hotels_card2' },
  { code: 'DB20019414', sub1: 'home_hotels_card3' },
];
export const TRIP_CARD_SIZE = { width: 300, height: 250 } as const;

/** 위젯·배너 iframe 주소 — 표시 언어의 지역 사이트로 */
export function tripAdSrc(ad: TripAd, locale: string): string {
  const host = TRIP_HOST[normalizeLocale(locale)];
  const params = new URLSearchParams({ Allianceid: ALLIANCE_ID, SID, trip_sub1: ad.sub1 });
  return `https://${host}/partners/ad/${ad.code}?${params.toString()}`;
}
