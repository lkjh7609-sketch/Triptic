import { describe, expect, it } from 'vitest';
import {
  continentOf,
  defaultForeignAmount,
  formatKrwApprox,
  formatPriceRange,
  koreaTimeDiffMinutes,
  parseAmount,
  pickText,
  roundKrw,
  splitDiff,
  weatherKey,
} from './channelHelpers';

describe('channelHelpers', () => {
  it('나라 코드로 대륙을 찾는다', () => {
    expect(continentOf('MY')).toBe('AS');
    expect(continentOf('FR')).toBe('EU');
    expect(continentOf('GU')).toBe('NA'); // 괌·사이판은 미주 안
    expect(continentOf('AU')).toBe('OC');
    expect(continentOf('XX')).toBeNull();
  });

  it('두 벌 문구는 한국어일 때만 한국어, 나머지는 영어', () => {
    const text = { ko: '3박 4일', en: '3 nights' };
    expect(pickText(text, 'ko')).toBe('3박 4일');
    expect(pickText(text, 'ja')).toBe('3 nights');
    expect(pickText(text, 'zh-TW')).toBe('3 nights');
    expect(pickText(null, 'ko')).toBe('');
  });

  it('한국과의 시차 — 쿠알라룸푸르 -1시간, 인도 -3시간 30분, 도쿄·서울 0, 괌 +1시간', () => {
    const at = new Date('2026-10-02T03:00:00Z');
    expect(koreaTimeDiffMinutes('Asia/Kuala_Lumpur', at)).toBe(-60);
    expect(koreaTimeDiffMinutes('Asia/Kolkata', at)).toBe(-210);
    expect(koreaTimeDiffMinutes('Asia/Tokyo', at)).toBe(0);
    expect(koreaTimeDiffMinutes('Asia/Seoul', at)).toBe(0);
    expect(koreaTimeDiffMinutes('Pacific/Guam', at)).toBe(60);
    expect(koreaTimeDiffMinutes('Not/AZone', at)).toBeNull();
  });

  it('서머타임을 그 시점 기준으로 반영한다', () => {
    expect(koreaTimeDiffMinutes('Europe/Paris', new Date('2026-07-01T00:00:00Z'))).toBe(-7 * 60);
    expect(koreaTimeDiffMinutes('Europe/Paris', new Date('2026-12-01T00:00:00Z'))).toBe(-8 * 60);
  });

  it('시차를 시·분으로 나눈다', () => {
    expect(splitDiff(-210)).toEqual({ hours: 3, minutes: 30, ahead: false });
    expect(splitDiff(60)).toEqual({ hours: 1, minutes: 0, ahead: true });
  });

  it('WeatherKit 날씨 상태(줄인 9종)를 문구 묶음으로', () => {
    expect(weatherKey('clear')).toBe('clear');
    expect(weatherKey('partly_cloudy')).toBe('partly');
    expect(weatherKey('cloudy')).toBe('cloudy');
    expect(weatherKey('fog')).toBe('fog');
    expect(weatherKey('rain')).toBe('rain');
    expect(weatherKey('snow')).toBe('snow');
    expect(weatherKey('thunderstorm')).toBe('thunder');
    expect(weatherKey('wind')).toBeNull();
    expect(weatherKey('unknown')).toBeNull();
  });

  it('금액 범위와 원화 어림값', () => {
    expect(formatPriceRange(8, 14, 'MYR', 'ko')).toBe('8~14 MYR');
    expect(formatPriceRange(11, null, 'MYR', 'ko')).toBe('11 MYR');
    expect(formatPriceRange(40_000, 90_000, 'VND', 'en')).toBe('40,000~90,000 VND');
    expect(roundKrw(3_437)).toBe(3_400);
    expect(roundKrw(437)).toBe(440);
    expect(formatKrwApprox(6, 10, 312.4, 'ko')).toBe('≈ ₩1,900~₩3,100');
  });

  it('계산기 입력 해석', () => {
    expect(parseAmount('1,234.5')).toBe(1234.5);
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('-5')).toBeNull();
  });

  it('계산기 처음 금액은 원화 1만~10만 원쯤', () => {
    expect(defaultForeignAmount(312.4)).toBe(100); // MYR
    expect(defaultForeignAmount(1400)).toBe(10); // USD
    expect(defaultForeignAmount(9.3)).toBe(10_000); // JPY
    expect(defaultForeignAmount(20_000)).toBe(1);
  });
});
