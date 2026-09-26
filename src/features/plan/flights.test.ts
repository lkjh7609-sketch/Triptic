import { describe, it, expect } from 'vitest';
import { extractLocalTime, flightPreviewText } from './flights';
import type { TFunction } from 'i18next';
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
    airline: 'Asiana',
    dep: { iata: 'ICN', name: 'Incheon', lat: 0, lng: 0, time: '08:00' },
    arr: { iata: 'NRT', name: 'Narita', lat: 0, lng: 0, time: '10:30' },
  };
  const t = ((key: string, vars?: Record<string, string>) =>
    key === 'plan:flight.preview' ? `${vars!.dep} ${vars!.depTime} → ${vars!.arr} ${vars!.arrTime}` : '(manual)') as unknown as TFunction;

  it('항공사·출발·도착 시각을 포함한 미리보기 문자열을 만든다', () => {
    expect(flightPreviewText(flight, t)).toBe('Asiana · ICN 08:00 → NRT 10:30');
  });

  it('수동 입력이면 표시를 덧붙인다', () => {
    expect(flightPreviewText({ ...flight, manual: true }, t)).toBe('Asiana · ICN 08:00 → NRT 10:30 (manual)');
  });

  it('null이면 빈 문자열', () => {
    expect(flightPreviewText(null, t)).toBe('');
  });
});
