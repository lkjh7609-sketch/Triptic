import { describe, it, expect } from 'vitest';
import { extractLocalTime, flightPreviewText } from './flights';
import type { FlightInfo } from './types';

describe('extractLocalTime', () => {
  it('ISO 문자열에서 HH:mm만 추출한다', () => {
    expect(extractLocalTime('2026-05-20T08:30:00+09:00')).toBe('08:30');
  });

  it('값이 없으면 빈 문자열', () => {
    expect(extractLocalTime(null)).toBe('');
    expect(extractLocalTime(undefined)).toBe('');
  });

  it('시간 패턴이 없으면 빈 문자열', () => {
    expect(extractLocalTime('invalid')).toBe('');
  });
});

describe('flightPreviewText', () => {
  const flight: FlightInfo = {
    flightNo: 'OZ102',
    date: '2026-05-20',
    airline: '아시아나항공',
    dep: { iata: 'ICN', name: '인천', lat: 0, lng: 0, time: '08:00' },
    arr: { iata: 'NRT', name: '나리타', lat: 0, lng: 0, time: '10:30' },
  };

  it('항공사·출발·도착 시각을 포함한 미리보기 문자열을 만든다', () => {
    expect(flightPreviewText(flight)).toBe('✅ 아시아나항공 · ICN 08:00 출발 → NRT 10:30 도착');
  });

  it('수동 입력이면 "(직접 입력)"을 덧붙인다', () => {
    expect(flightPreviewText({ ...flight, manual: true })).toContain('(직접 입력)');
  });

  it('null이면 빈 문자열', () => {
    expect(flightPreviewText(null)).toBe('');
  });
});
