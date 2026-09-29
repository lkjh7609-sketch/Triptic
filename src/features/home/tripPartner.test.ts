import { describe, expect, it } from 'vitest';
import { TRIP_WIDGET_SRC, tripWidgetSrc } from './tripPartner';

describe('tripWidgetSrc', () => {
  it('한국어는 파트너 센터에서 만든 주소 그대로', () => {
    expect(tripWidgetSrc('ko')).toBe(
      'https://kr.trip.com/partners/ad/S20018532?Allianceid=10792895&SID=332524291&trip_sub1=home_hotels',
    );
  });

  it('표시 언어에 맞는 트립닷컴 지역 사이트로 — 브라우저 언어 태그(en-US·ja-JP·zh-HK)도 앱 언어로 맞춘다', () => {
    expect(new URL(tripWidgetSrc('en')).host).toBe('www.trip.com');
    expect(new URL(tripWidgetSrc('en-US')).host).toBe('www.trip.com');
    expect(new URL(tripWidgetSrc('ja')).host).toBe('jp.trip.com');
    expect(new URL(tripWidgetSrc('ja-JP')).host).toBe('jp.trip.com');
    expect(new URL(tripWidgetSrc('zh-TW')).host).toBe('tw.trip.com');
    expect(new URL(tripWidgetSrc('zh-HK')).host).toBe('tw.trip.com');
  });

  it('지원하지 않는 언어는 한국어(앱 기본)로', () => {
    expect(tripWidgetSrc('fr')).toBe(TRIP_WIDGET_SRC.ko);
  });

  it('모든 언어의 주소가 같은 제휴 아이디·위젯 코드·자리 표시를 쓴다', () => {
    for (const src of Object.values(TRIP_WIDGET_SRC)) {
      const url = new URL(src);
      expect(url.pathname).toBe('/partners/ad/S20018532');
      expect(url.searchParams.get('Allianceid')).toBe('10792895');
      expect(url.searchParams.get('SID')).toBe('332524291');
      expect(url.searchParams.get('trip_sub1')).toBe('home_hotels');
    }
  });
});
