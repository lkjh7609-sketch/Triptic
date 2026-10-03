import { describe, expect, it } from 'vitest';
import {
  boardWindow,
  buildPages,
  dotWindow,
  startOffset,
  delayMinutes,
  cleanHhmm,
  extractItems,
  formatHhmm,
  hhmmToMinutes,
  isNormalResponse,
  kstNow,
  minutesFromNow,
  normalizeBoard,
  statusInfo,
  terminalLabel,
  visibleFlights,
  type BoardFlight,
  type RawFlight,
} from './boardParse';

const raw = (over: Partial<RawFlight>): RawFlight => ({
  airline: '대한항공',
  flightId: 'KE1',
  scheduleDateTime: '1000',
  estimatedDateTime: '1000',
  airport: '도쿄',
  airportCode: 'NRT',
  terminalId: 'P03',
  remark: '탑승준비',
  codeshare: 'Master',
  masterflightid: '',
  ...over,
});

const flight = (over: Partial<BoardFlight>): BoardFlight => ({
  id: 'KE1',
  airline: '대한항공',
  scheduled: '1000',
  estimated: '1000',
  city: '도쿄',
  airportCode: 'NRT',
  terminal: 'P03',
  gate: '',
  counter: '',
  carousel: '',
  exit: '',
  remark: '',
  codeshares: [],
  stopovers: [],
  ...over,
});

describe('시각 다루기', () => {
  it('HHMM만 받아들이고 HH:MM으로 보여 준다', () => {
    expect(cleanHhmm('0905')).toBe('0905');
    expect(cleanHhmm('2460')).toBe('');
    expect(cleanHhmm('9:05')).toBe('');
    expect(cleanHhmm(null)).toBe('');
    expect(formatHhmm('0905')).toBe('09:05');
    expect(hhmmToMinutes('0130')).toBe(90);
    expect(hhmmToMinutes('xx')).toBeNull();
  });

  it('한국 시각으로 지금을 구한다(UTC 15:30 = KST 00:30)', () => {
    expect(kstNow(new Date('2026-10-03T15:30:00Z'))).toEqual({ hhmm: '0030', minutes: 30 });
    expect(kstNow(new Date('2026-10-03T03:07:00Z'))).toEqual({ hhmm: '1207', minutes: 727 });
  });

  it('조회 시간대는 지금 -1시간 ~ +4시간, 하루를 넘지 않는다', () => {
    expect(boardWindow(new Date('2026-10-03T03:07:00Z'))).toEqual({ from: '1107', to: '1607' });
    expect(boardWindow(new Date('2026-10-03T15:30:00Z'))).toEqual({ from: '0000', to: '0430' }); // KST 00:30
    expect(boardWindow(new Date('2026-10-03T13:30:00Z'))).toEqual({ from: '2130', to: '2359' }); // KST 22:30
  });
});

describe('normalizeBoard', () => {
  it('공동운항(Slave)은 대표 편 아래로 묶고, 시각→편명 순으로 정렬한다', () => {
    const board = normalizeBoard([
      raw({ flightId: 'KE2', scheduleDateTime: '1100', estimatedDateTime: '1100' }),
      raw({ flightId: 'OZ9', airline: '아시아나항공', codeshare: 'Slave', masterflightid: 'KE1' }),
      raw({ flightId: 'KE1' }),
      raw({ flightId: 'AA1', airline: '아메리칸항공', codeshare: 'Slave', masterflightid: 'KE1' }),
    ]);
    expect(board.map((f) => f.id)).toEqual(['KE1', 'KE2']);
    expect(board[0].codeshares).toEqual([
      { id: 'OZ9', airline: '아시아나항공' },
      { id: 'AA1', airline: '아메리칸항공' },
    ]);
  });

  it('대표 편이 이 시간대에 없으면 공동운항 편이 자기 줄이 된다', () => {
    const board = normalizeBoard([
      raw({ flightId: 'OZ9', codeshare: 'Slave', masterflightid: 'KE-GONE' }),
    ]);
    expect(board.map((f) => f.id)).toEqual(['OZ9']);
  });

  it('편명·예정 시각이 없거나 모양이 틀린 줄은 버리고, 같은 편명은 처음 것만, 변경 시각이 없으면 예정과 같다', () => {
    const board = normalizeBoard([
      raw({ flightId: '' }),
      raw({ flightId: 'KE3', scheduleDateTime: '' }),
      raw({ flightId: 'KE4', estimatedDateTime: '', gatenumber: ' 23 ', remark: ' 지연 ' }),
      raw({ flightId: 'KE4', scheduleDateTime: '2000' }),
    ]);
    expect(board).toHaveLength(1);
    expect(board[0]).toMatchObject({ id: 'KE4', estimated: '1000', gate: '23', remark: '지연' });
  });

  it('도착편의 수하물 수취대·출구와 경유지를 담는다', () => {
    const [f] = normalizeBoard([
      raw({ carousel: '6', exitnumber: 'B', firstopovername: '홍콩', secstopovername: '' }),
    ]);
    expect(f).toMatchObject({ carousel: '6', exit: 'B', stopovers: ['홍콩'] });
  });
});

describe('extractItems / isNormalResponse', () => {
  it('배열·한 줄 객체·빈 문자열·null 어느 모양이든 배열로', () => {
    expect(
      extractItems({ response: { body: { items: [{ flightId: 'A' }, { flightId: 'B' }] } } }),
    ).toHaveLength(2);
    expect(extractItems({ response: { body: { items: { flightId: 'A' } } } })).toHaveLength(1);
    expect(extractItems({ response: { body: { items: '' } } })).toEqual([]);
    expect(extractItems({ response: { body: { items: null } } })).toEqual([]);
    expect(extractItems(null)).toEqual([]);
    expect(
      extractItems({ response: { body: { items: { item: [{ flightId: 'A' }] } } } }),
    ).toHaveLength(1);
  });

  it('결과 코드 00만 정상', () => {
    expect(isNormalResponse({ response: { header: { resultCode: '00' } } })).toBe(true);
    expect(isNormalResponse({ response: { header: { resultCode: '30' } } })).toBe(false);
    expect(isNormalResponse({ OpenAPI_ServiceResponse: {} })).toBe(false);
  });
});

describe('지금 기준 편 고르기', () => {
  it('변경 시각 기준으로 몇 분 뒤인지, 자정을 넘겨도 맞다', () => {
    expect(minutesFromNow(flight({ scheduled: '1000', estimated: '1015' }), 600)).toBe(15);
    expect(minutesFromNow(flight({ scheduled: '0005', estimated: '0005' }), 1430)).toBe(15); // 23:50 → 00:05
    expect(minutesFromNow(flight({ scheduled: '2355', estimated: '2355' }), 10)).toBe(-15); // 00:10, 방금 전 23:55
  });

  it('얼마나 늦춰졌는지(앞당겨졌으면 음수, 자정을 넘겨도 맞게)', () => {
    expect(delayMinutes(flight({ scheduled: '1000', estimated: '1040' }))).toBe(40);
    expect(delayMinutes(flight({ scheduled: '1000', estimated: '0953' }))).toBe(-7);
    expect(delayMinutes(flight({ scheduled: '2350', estimated: '0010' }))).toBe(20);
    expect(delayMinutes(flight({ scheduled: '1000', estimated: '1000' }))).toBe(0);
  });

  it('지난 지 10분이 넘은 편은 빼고 예상 시각 순으로 — 늦춰진 편은 늦춰진 자리에', () => {
    const list = [
      flight({ id: 'OLD', scheduled: '0940', estimated: '0940' }),
      flight({ id: 'JUST', scheduled: '0950', estimated: '0950' }),
      flight({ id: 'LATE', scheduled: '1000', estimated: '1140' }),
      flight({ id: 'NEXT', scheduled: '1030', estimated: '1030' }),
    ];
    expect(visibleFlights(list, 600).map((f) => f.id)).toEqual(['JUST', 'NEXT', 'LATE']);
  });
});

describe('visibleFlights — 오래된 값', () => {
  it('받아 온 시간대보다 먼 미래로 보이는 편(반나절 전 값이 자정 맞춤으로 내일 편이 되는 경우)은 뺀다', () => {
    const list = [
      flight({ id: 'MORNING', scheduled: '0900', estimated: '0900' }),
      flight({ id: 'SOON', scheduled: '2200', estimated: '2200' }),
    ];
    expect(visibleFlights(list, 1300).map((f) => f.id)).toEqual(['SOON']); // 21:40 — 09:00은 11시간 전이라 +13시간 뒤로 읽힌다
  });
});

describe('상태·터미널', () => {
  it('알려진 상태는 번역 키와 톤, 모르는 문구는 null', () => {
    expect(statusInfo('탑승중')).toEqual({ key: 'boarding', tone: 'active' });
    expect(statusInfo(' 지연 ')).toEqual({ key: 'delayed', tone: 'warn' });
    expect(statusInfo('결항')?.tone).toBe('bad');
    expect(statusInfo('처음 보는 문구')).toBeNull();
  });

  it('터미널 코드', () => {
    expect(terminalLabel('P01').key).toBe('t1');
    expect(terminalLabel('P02').key).toBe('t1c');
    expect(terminalLabel('P03').key).toBe('t2');
    expect(terminalLabel('X').key).toBeNull();
  });
});

describe('쪽 나누기', () => {
  const at = (id: string, hhmm: string) => flight({ id, scheduled: hhmm, estimated: hhmm });

  it('지금 +40분 이후 첫 편에서 시작한다. 그런 편이 없으면 마지막 쪽', () => {
    const list = [
      at('A', '0955'),
      at('B', '1000'),
      at('C', '1030'),
      at('D', '1039'),
      at('E', '1041'),
      at('F', '1100'),
    ];
    expect(startOffset(list, 600, 40, 8)).toBe(4); // 10:40 이후 첫 편 = E
    expect(startOffset(list, 600, 0, 8)).toBe(0);
    expect(startOffset(list, 900, 40, 4)).toBe(2); // 늦은 밤 — 모두 지나서 끝 4개
    expect(startOffset([], 600, 40, 8)).toBe(0);
  });

  it('offset에서 앞으로 size개씩, 그 앞 줄은 거꾸로 묶는다(맨 앞 쪽만 모자람)', () => {
    const items = Array.from({ length: 21 }, (_, i) => i);
    const { pages, initial } = buildPages(items, 10, 8);
    expect(pages.map((p) => p.length)).toEqual([2, 8, 8, 3]); // 앞: 0-1, 2-9 / 뒤: 10-17, 18-20
    expect(pages[initial][0]).toBe(10);
    expect(pages.flat()).toEqual(items);
  });

  it('offset이 0이면 보통의 쪽 나누기, 비어 있으면 빈 쪽 하나', () => {
    expect(buildPages([1, 2, 3], 0, 2)).toEqual({ pages: [[1, 2], [3]], initial: 0 });
    expect(buildPages([], 0, 8)).toEqual({ pages: [[]], initial: 0 });
    expect(buildPages([1, 2], 99, 8).pages.flat()).toEqual([1, 2]);
  });

  it('점 표시는 7개까지만 현재 둘레로 옮겨 가고, 앞뒤에 더 있으면 알려 준다', () => {
    expect(dotWindow(0, 1)).toEqual({ start: 0, count: 1, before: false, after: false });
    expect(dotWindow(2, 5)).toEqual({ start: 0, count: 5, before: false, after: false });
    expect(dotWindow(0, 20)).toEqual({ start: 0, count: 7, before: false, after: true });
    expect(dotWindow(10, 20)).toEqual({ start: 7, count: 7, before: true, after: true });
    expect(dotWindow(19, 20)).toEqual({ start: 13, count: 7, before: true, after: false });
  });
});
