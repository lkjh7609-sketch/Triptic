import { describe, expect, it } from 'vitest';
import { airportCardLabel, type Airport } from './airports/airportData';
import {
  flightPreviewText,
  flightScheduleText,
  returnFlightDay,
  tripEndExtension,
} from './flights';
import type { FlightInfo } from './types';

const t = ((key: string, o?: Record<string, string>) =>
  key === 'plan:flightCard.schedule'
    ? `${o?.depTime} 출발 → ${o?.arrTime} 도착`
    : key === 'plan:flightCard.arriveOnly'
      ? `${o?.arrTime} 도착`
      : key === 'plan:flight.preview'
        ? `${o?.dep} ${o?.depTime} 출발 → ${o?.arr} ${o?.arrTime} 도착`
        : key.startsWith('home:airport.terminalShort.')
          ? key.split('.').pop()!.toUpperCase()
          : key) as never;

const flight = (over: Partial<FlightInfo> = {}): FlightInfo => ({
  flightNo: 'KE624',
  date: '2026-10-21',
  dep: { iata: 'MNL', name: '마닐라', lat: 14.5, lng: 121, time: '' },
  arr: { iata: 'ICN', name: '인천', lat: 37.4, lng: 126.4, time: '04:35' },
  ...over,
});

describe('returnFlightDay', () => {
  it('도착일이 있으면 그날의 일차, 없으면 마지막 일차, 범위 밖이면 가장 가까운 일차', () => {
    expect(returnFlightDay(flight({ arrDate: '2026-10-22' }), '2026-10-14', 9)).toBe(9);
    expect(returnFlightDay(flight({ arrDate: '2026-10-22' }), '2026-10-14', 8)).toBe(8);
    expect(returnFlightDay(flight(), '2026-10-14', 8)).toBe(8);
    expect(returnFlightDay(flight({ arrDate: '2026-10-10' }), '2026-10-14', 8)).toBe(1);
    expect(returnFlightDay(null, '2026-10-14', 8)).toBe(8);
  });
});

describe('tripEndExtension', () => {
  it('도착일이 종료일보다 늦으면 그 날짜, 아니면 null(줄이지 않는다)', () => {
    expect(
      tripEndExtension({ outbound: null, return: { arrDate: '2026-10-22' } }, '2026-10-21'),
    ).toBe('2026-10-22');
    expect(
      tripEndExtension({ outbound: null, return: { arrDate: '2026-10-21' } }, '2026-10-21'),
    ).toBeNull();
    expect(tripEndExtension({ outbound: null, return: {} }, '2026-10-21')).toBeNull();
    expect(
      tripEndExtension({ outbound: null, return: { arrDate: '2026-10-22' } }, null),
    ).toBeNull();
  });
});

describe('flightScheduleText / flightPreviewText', () => {
  it('출발 시간을 모르면 도착 시간만 보여 준다', () => {
    expect(flightScheduleText(flight(), t)).toBe('04:35 도착');
    expect(
      flightScheduleText(
        flight({
          dep: { iata: 'ICN', name: '', lat: null, lng: null, time: '18:50' },
          arr: { iata: 'MNL', name: '', lat: null, lng: null, time: '22:05' },
        }),
        t,
      ),
    ).toBe('18:50 출발 → 22:05 도착');
  });

  it('밤새 도착이면 요약 줄 도착 시간에 날짜가 붙는다', () => {
    expect(flightPreviewText(flight({ arrDate: '2026-10-22' }), t, 'ko')).toContain(
      'ICN 10/22 04:35 도착',
    );
    expect(flightPreviewText(flight(), t, 'ko')).toContain('ICN 04:35 도착');
  });
});

describe('airportCardLabel', () => {
  const airports: Airport[] = [
    {
      iata: 'ICN',
      country_code: 'KR',
      name: { ko: '인천국제공항', en: 'Incheon International Airport' },
      city: { ko: '서울', en: 'Seoul' },
      lat: 37.4,
      lng: 126.4,
      timezone: 'Asia/Seoul',
    },
  ];
  it('코드로 공항 목록에서 찾아 표시 언어의 공항 이름 + 코드', () => {
    expect(airportCardLabel({ iata: 'ICN', name: '서울(대한민국) ICN' }, airports, 'ko')).toBe(
      '인천국제공항 ICN',
    );
    expect(airportCardLabel({ iata: 'ICN', name: '서울(대한민국) ICN' }, airports, 'en')).toBe(
      'Incheon International Airport ICN',
    );
  });
  it('목록에 없거나 코드가 없으면 저장된 이름', () => {
    expect(airportCardLabel({ iata: 'ZZZ', name: '어딘가' }, airports, 'ko')).toBe('어딘가');
    expect(airportCardLabel({ iata: '', name: '예전 공항' }, airports, 'ko')).toBe('예전 공항');
    expect(airportCardLabel({ iata: '', name: '' }, undefined, 'ko')).toBe('?');
  });
});
