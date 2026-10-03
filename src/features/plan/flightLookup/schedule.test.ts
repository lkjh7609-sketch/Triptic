import { describe, expect, it } from 'vitest';
import {
  buildIcnFlight,
  hhmmToTime,
  kacArrivalTime,
  missReason,
  normalizeFlightNo,
  normalizeIcnSchedule,
  pickDomestic,
  pickIcnRow,
  rowCoversDate,
  toYmd,
  weekdayIndex,
} from './schedule';

const raw = (over: Record<string, unknown> = {}) => ({
  flightId: 'KE623',
  st: '1850',
  firstdate: '20260828',
  lastdate: '20261024',
  ynMon: 'Y',
  ynTue: 'Y',
  ynWed: 'Y',
  ynThu: 'Y',
  ynFri: 'Y',
  ynSat: 'Y',
  ynSun: 'Y',
  terminalId: 'P03',
  airline: '대한항공',
  airlineCode: 'KE',
  airportCode: 'MNL',
  airport: '마닐라',
  ...over,
});

describe('기본 정리', () => {
  it('편명·시각·날짜·요일', () => {
    expect(normalizeFlightNo(' ke-623 ')).toBe('KE623');
    expect(hhmmToTime('0905')).toBe('09:05');
    expect(hhmmToTime('2460')).toBe('');
    expect(hhmmToTime(null)).toBe('');
    expect(toYmd('20261015')).toBe('2026-10-15');
    expect(toYmd('2026-10-15T00:00:00')).toBe('2026-10-15');
    expect(weekdayIndex('2026-10-05')).toBe(0); // 월요일
    expect(weekdayIndex('2026-10-11')).toBe(6); // 일요일
  });
});

describe('인천 시즌 스케줄', () => {
  it('줄을 표 행으로 만들고 터미널 코드를 화면 키로 바꾼다', () => {
    const [row] = normalizeIcnSchedule([raw(), raw({ flightId: '' }), raw({ st: 'x' })], 'dep');
    expect(row).toMatchObject({
      flight_id: 'KE623',
      direction: 'dep',
      first_date: '2026-08-28',
      last_date: '2026-10-24',
      st: '1850',
      terminal: 't2',
      airline_code: 'KE',
      other_airport_code: 'MNL',
    });
    expect(row.days).toEqual([true, true, true, true, true, true, true]);
    expect(normalizeIcnSchedule([raw(), raw({ flightId: '' })], 'dep')).toHaveLength(1);
    expect(row.master_flight_id).toBe('');
  });

  it('공동운항(Slave) 편은 대표 편명을 남긴다', () => {
    const [row] = normalizeIcnSchedule(
      [raw({ flightId: 'DL7926', codeshare: 'Slave', masterFlightId: 'KE623' })],
      'dep',
    );
    expect(row.master_flight_id).toBe('KE623');
  });

  it('기간과 요일이 맞는 줄만 고르고, 겹치면 더 최근에 시작한 줄', () => {
    const weekdaysOnly = normalizeIcnSchedule([raw({ ynSat: 'N', ynSun: 'N' })], 'dep')[0];
    expect(rowCoversDate(weekdaysOnly, '2026-10-09')).toBe(true); // 금
    expect(rowCoversDate(weekdaysOnly, '2026-10-10')).toBe(false); // 토
    expect(rowCoversDate(weekdaysOnly, '2026-10-25')).toBe(false); // 기간 밖
    const rows = normalizeIcnSchedule(
      [raw({ firstdate: '20260301', st: '1000' }), raw({ firstdate: '20260828', st: '1850' })],
      'dep',
    );
    expect(pickIcnRow(rows, '2026-10-01')?.st).toBe('1850');
    expect(pickIcnRow(rows, '2027-01-01')).toBeNull();
  });

  it('못 찾은 이유: 편명 없음 / 기간 밖 / 아직 공개 안 된 날짜', () => {
    const rows = normalizeIcnSchedule([raw({ ynSat: 'N', ynSun: 'N' })], 'dep');
    expect(missReason([], '2026-10-09')).toBe('not_found');
    expect(missReason(rows, '2026-10-10')).toBe('out_of_range'); // 기간 안인데 그 요일엔 안 뜸
    expect(missReason(rows, '2027-01-15')).toBe('not_published');
  });

  it('출발편은 인천이 출발·상대 공항이 도착, 도착편은 반대 — 상대 공항 시각은 있으면만', () => {
    const dep = buildIcnFlight(normalizeIcnSchedule([raw()], 'dep')[0], '2026-10-15', '22:05');
    expect(dep.dep).toEqual({ iata: 'ICN', nameKo: '인천', time: '18:50', terminal: 't2' });
    expect(dep.arr).toEqual({ iata: 'MNL', nameKo: '마닐라', time: '22:05', terminal: null });
    const arr = buildIcnFlight(
      normalizeIcnSchedule([raw({ flightId: 'KE624', st: '0435' })], 'arr')[0],
      '2026-10-15',
      '',
    );
    expect(arr.dep).toEqual({ iata: 'MNL', nameKo: '마닐라', time: '', terminal: null });
    expect(arr.arr).toMatchObject({ iata: 'ICN', time: '04:35', terminal: 't2' });
  });
});

describe('한국공항공사', () => {
  const int = (over: Record<string, unknown> = {}) => ({
    internationalNum: 'KE623',
    cityCode: 'ICN',
    airportCode: 'MNL',
    internationalTime: '2205',
    internationalStdate: '2026-08-28T00:00:00',
    internationalEddate: '2026-10-24T00:00:00',
    internationalMon: 'Y',
    internationalTue: 'Y',
    internationalWed: 'Y',
    internationalThu: 'Y',
    internationalFri: 'Y',
    internationalSat: 'Y',
    internationalSun: 'Y',
    ...over,
  });

  it('국제선: 출발 공항(cityCode)→도착 공항(airportCode) 줄의 도착 시각을 현지 시각 그대로 쓴다', () => {
    expect(kacArrivalTime([int()], 'KE623', 'ICN', 'MNL', '2026-10-15')).toBe('22:05');
    // 방향이 반대인 줄(상대 공항→인천)은 쓰지 않는다
    expect(
      kacArrivalTime(
        [int({ cityCode: 'MNL', airportCode: 'ICN' })],
        'KE623',
        'ICN',
        'MNL',
        '2026-10-15',
      ),
    ).toBe('');
    // 기간 밖
    expect(kacArrivalTime([int()], 'KE623', 'ICN', 'MNL', '2026-11-15')).toBe('');
    // 다른 편명
    expect(
      kacArrivalTime([int({ internationalNum: 'KE625' })], 'KE623', 'ICN', 'MNL', '2026-10-15'),
    ).toBe('');
    expect(kacArrivalTime(null, 'KE623', 'ICN', 'MNL', '2026-10-15')).toBe('');
  });

  it('국내선: 출발·도착 시각이 모두 채워지고 기간·요일이 맞아야 한다', () => {
    const dom = (over: Record<string, unknown> = {}) => ({
      airlineKorean: '대한항공',
      domesticNum: 'KE1493',
      startcityCode: 'ICN',
      startcity: '인천',
      arrivalcityCode: 'TAE',
      arrivalcity: '대구',
      domesticStartTime: '0515',
      domesticArrivalTime: '0605',
      domesticStdate: '2026-03-29T00:00:00',
      domesticEddate: '2026-10-24T00:00:00',
      domesticMon: 'Y',
      domesticTue: 'Y',
      domesticWed: 'N',
      domesticThu: 'N',
      domesticFri: 'N',
      domesticSat: 'N',
      domesticSun: 'N',
      ...over,
    });
    const f = pickDomestic([dom()], 'KE1493', '2026-10-13'); // 화요일
    expect(f).toMatchObject({
      flightNo: 'KE1493',
      airlineKo: '대한항공',
      airlineCode: 'KE',
      source: 'kac-dom',
    });
    expect(f?.dep).toEqual({ iata: 'ICN', nameKo: '인천', time: '05:15', terminal: null });
    expect(f?.arr).toEqual({ iata: 'TAE', nameKo: '대구', time: '06:05', terminal: null });
    expect(pickDomestic([dom()], 'KE1493', '2026-10-14')).toBeNull(); // 수요일
    expect(pickDomestic([dom()], 'KE9999', '2026-10-13')).toBeNull();
  });
});
