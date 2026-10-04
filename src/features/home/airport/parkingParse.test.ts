import { describe, expect, it } from 'vitest';
import {
  congestionByRate,
  extractParkingItems,
  icnTime,
  isNormalParkingResponse,
  normalizeIcn,
  normalizeKac,
  occupancyPct,
  remaining,
} from './parkingParse';

// 2026-10-04 실제 응답에서 줄인 것
const kacStatus = {
  response: {
    header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
    body: {
      items: {
        item: [
          { parkingGetdate: '2026-10-04', parkingGettime: '18:53:03', parkingFullSpace: 2279, aprKor: '김포국제공항', parkingAirportCodeName: '국내선 제1주차장', parkingIincnt: 1443, parkingIoutcnt: 1152, parkingIstay: 2101 },
          { parkingGetdate: '2026-10-04', parkingGettime: '18:53:03', parkingFullSpace: 2005, aprKor: '김해국제공항', parkingAirportCodeName: 'P1 여객주차장', parkingIstay: 1948 },
          { parkingGetdate: '2026-10-04', parkingGettime: '18:53:03', parkingFullSpace: 1361, aprKor: '대구국제공항', parkingAirportCodeName: '여객주차장', parkingIstay: 1278 },
          { parkingGetdate: '2026-10-04', parkingGettime: '18:53:03', parkingFullSpace: 1176, aprKor: '광주공항', parkingAirportCodeName: '여객주차장(제1+제2)', parkingIstay: 1065 },
        ],
      },
    },
  },
};
const kacCongestion = {
  response: {
    header: { resultCode: '00' },
    body: {
      items: {
        item: [
          { airportKor: '김포국제공항', parkingAirportCodeName: '국내선 제1주차장', parkingCongestionDegree: '92.19%', parkingCongestion: '혼잡' },
          { airportKor: '김해국제공항', parkingAirportCodeName: 'P1 여객주차장', parkingCongestionDegree: '97.16%', parkingCongestion: '만차' },
          // 대구 '여객주차장'은 판정이 '원활' — 이름이 같은 광주 '여객주차장(제1+제2)'과 섞이면 안 된다
          { airportKor: '대구국제공항', parkingAirportCodeName: '여객주차장', parkingCongestionDegree: '93.9%', parkingCongestion: '원활' },
        ],
      },
    },
  },
};
const icn = {
  response: {
    header: { resultCode: '00' },
    body: {
      items: [
        { floor: 'T1 단기주차장지하1층', parking: '557', parkingarea: '520', datetm: '20261004185841.000' },
        { floor: 'T1 단기주차장지하3층', parking: '392', parkingarea: '639', datetm: '20261004185841.000' },
        { floor: 'T2 예약 주차장', parking: '2347', parkingarea: '3779', datetm: '20261004185746.000' },
        { floor: 'T1 장기 P1 주차타워', parking: '1370', parkingarea: '1379', datetm: '20261004185743.000' },
      ],
    },
  },
};

describe('응답 꺼내기', () => {
  it('한국공항공사는 items.item, 인천은 items가 바로 배열 — 둘 다 꺼낸다. 정상 코드도 확인', () => {
    expect(extractParkingItems(kacStatus)).toHaveLength(4);
    expect(extractParkingItems(icn)).toHaveLength(4);
    expect(extractParkingItems({ response: { body: { items: { item: { a: 1 } } } } })).toEqual([{ a: 1 }]);
    expect(extractParkingItems({ OpenAPI_ServiceResponse: {} })).toEqual([]);
    expect(isNormalParkingResponse(kacStatus)).toBe(true);
    expect(isNormalParkingResponse({ OpenAPI_ServiceResponse: { cmmMsgHeader: { returnReasonCode: '30' } } })).toBe(false);
  });
});

describe('normalizeKac', () => {
  const lots = normalizeKac(extractParkingItems(kacStatus), extractParkingItems(kacCongestion));

  it('공항 이름을 코드로, 판정은 혼잡도 API 것을 공항+주차장 이름으로 잇는다(API 판정 그대로)', () => {
    const gmp = lots.find((l) => l.airport === 'GMP')!;
    expect(gmp).toMatchObject({ name: '국내선 제1주차장', total: 2279, occupied: 2101, congestion: 'busy', updatedAt: '2026-10-04T18:53:03+09:00' });
    expect(lots.find((l) => l.airport === 'PUS')!.congestion).toBe('full');
    // 93.9%여도 API가 원활이라 하면 원활
    expect(lots.find((l) => l.airport === 'TAE')!.congestion).toBe('smooth');
  });

  it('판정이 없으면 직전 값, 그것도 없으면 점유율로 계산한다', () => {
    const kwj = lots.find((l) => l.airport === 'KWJ')!;
    expect(kwj.congestion).toBe('busy'); // 1065/1176 = 90.6%
    const again = normalizeKac(extractParkingItems(kacStatus), [], lots);
    expect(again.find((l) => l.airport === 'TAE')!.congestion).toBe('smooth');
  });
});

describe('normalizeIcn', () => {
  const lots = normalizeIcn(extractParkingItems(icn));

  it('문자열 숫자·시각을 정리하고, 판정은 점유율로(90 미만 원활, 96 미만 혼잡, 그 이상·초과 만차)', () => {
    expect(lots[0]).toMatchObject({ airport: 'ICN', name: 'T1 단기주차장지하1층', total: 520, occupied: 557, congestion: 'full', updatedAt: '2026-10-04T18:58:41+09:00' });
    expect(lots[1].congestion).toBe('smooth'); // 61%
    expect(lots[2].congestion).toBe('smooth'); // 62%
    expect(lots[3].congestion).toBe('full'); // 99.3%
  });
});

describe('계산', () => {
  it('초과 주차는 남은 0대·점유율 100%로 자른다', () => {
    expect(remaining({ total: 520, occupied: 557 })).toBe(0);
    expect(occupancyPct({ total: 520, occupied: 557 })).toBe(100);
    expect(remaining({ total: 2005, occupied: 1948 })).toBe(57);
  });

  it('경계값', () => {
    expect(congestionByRate(899, 1000)).toBe('smooth');
    expect(congestionByRate(900, 1000)).toBe('busy');
    expect(congestionByRate(960, 1000)).toBe('full');
    expect(congestionByRate(0, 0)).toBe('full');
    expect(icnTime('bad')).toBeNull();
  });
});
