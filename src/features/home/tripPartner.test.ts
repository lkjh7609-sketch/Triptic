import { describe, expect, it } from 'vitest';
import { TRIP_HOTEL_CARDS, TRIP_HOTEL_WIDGET, tripAdSrc } from './tripPartner';

describe('tripAdSrc', () => {
  it('검색 위젯 — 파트너 센터에서 만든 주소 그대로(한국어)', () => {
    expect(tripAdSrc(TRIP_HOTEL_WIDGET, 'ko')).toBe(
      'https://kr.trip.com/partners/ad/S20018532?Allianceid=10792895&SID=332524291&trip_sub1=home_hotels',
    );
  });

  it('추천 호텔 배너 3개 — 만들어 준 코드와 카드마다 다른 자리 표시 그대로', () => {
    expect(TRIP_HOTEL_CARDS.map((c) => tripAdSrc(c, 'ko'))).toEqual([
      'https://kr.trip.com/partners/ad/DB20019386?Allianceid=10792895&SID=332524291&trip_sub1=home_hotels_card1',
      'https://kr.trip.com/partners/ad/DB20019407?Allianceid=10792895&SID=332524291&trip_sub1=home_hotels_card2',
      'https://kr.trip.com/partners/ad/DB20019414?Allianceid=10792895&SID=332524291&trip_sub1=home_hotels_card3',
    ]);
  });

  it('표시 언어에 맞는 지역 사이트로 — 브라우저 언어 태그(en-US·ja-JP·zh-HK)도 앱 언어로 맞춘다', () => {
    expect(new URL(tripAdSrc(TRIP_HOTEL_WIDGET, 'en')).host).toBe('www.trip.com');
    expect(new URL(tripAdSrc(TRIP_HOTEL_WIDGET, 'en-US')).host).toBe('www.trip.com');
    expect(new URL(tripAdSrc(TRIP_HOTEL_WIDGET, 'ja-JP')).host).toBe('jp.trip.com');
    expect(new URL(tripAdSrc(TRIP_HOTEL_WIDGET, 'zh-HK')).host).toBe('tw.trip.com');
    expect(new URL(tripAdSrc(TRIP_HOTEL_WIDGET, 'fr')).host).toBe('kr.trip.com');
  });
});
