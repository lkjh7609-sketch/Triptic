import { normalizeLocale, type SupportedLocale } from '@/shared/i18n';

/**
 * 트립닷컴 제휴 — 호텔 화면 검색창 위젯(파트너 센터 searchbox 도구로 만든 iframe).
 * 아이디는 iframe 주소로 브라우저에 그대로 보이는 공개 값이다. trip_sub1은 위젯이 놓인 자리를 구분하는
 * 표시로, 정산에서 어느 링크에서 왔는지 볼 때 쓴다.
 */
const WIDGET_CODE = 'S20018532';
const QUERY = new URLSearchParams({ Allianceid: '10792895', SID: '332524291', trip_sub1: 'home_hotels' }).toString();

/** 파트너 센터가 정한 위젯 크기(최대값) — 가로가 이보다 좁은 화면에서는 줄여서 보여준다 */
export const TRIP_WIDGET_SIZE = { width: 999, height: 222 } as const;

const widgetSrc = (host: string) => `https://${host}/partners/ad/${WIDGET_CODE}?${QUERY}`;

/**
 * 앱 표시 언어 → 그 언어로 뜨는 위젯 주소. 한국어는 파트너 센터에서 만든 주소 그대로이고, 나머지는 같은 코드를
 * 트립닷컴 지역 사이트(www 영어 / jp 일본어 / tw 번체 중국어)에 붙인 것이다.
 * ⚠️ 한국어 외의 주소는 실제 화면으로 확인하지 못했다(트립닷컴이 자동 접속을 인증 화면으로 막는다). 언어가
 * 안 맞게 뜨면 파트너 센터에서 그 언어로 다시 만든 주소를 여기에 그대로 넣는다.
 */
export const TRIP_WIDGET_SRC: Record<SupportedLocale, string> = {
  ko: widgetSrc('kr.trip.com'),
  en: widgetSrc('www.trip.com'),
  ja: widgetSrc('jp.trip.com'),
  'zh-TW': widgetSrc('tw.trip.com'),
};

export function tripWidgetSrc(locale: string): string {
  return TRIP_WIDGET_SRC[normalizeLocale(locale)];
}
