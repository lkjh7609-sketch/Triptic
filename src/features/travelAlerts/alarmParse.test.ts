import { describe, expect, it } from 'vitest';
import { decodeEntities, extractAlarmItems, normalizeAlarms } from './alarmParse';

function raw(code: string, lvl: string, ty: '전체' | '일부', remark: string) {
  return {
    alarm_lvl: lvl,
    country_iso_alp2: code,
    country_nm: '나라',
    country_eng_nm: 'Country',
    region_ty: ty,
    remark,
  };
}

describe('decodeEntities', () => {
  it('외교부 원문의 HTML 기호를 풀고 공백을 다듬는다', () => {
    expect(decodeEntities('로스토프&middot;벨고로드 &nbsp; 지부티&bull;소말리아')).toBe(
      '로스토프·벨고로드 지부티•소말리아',
    );
  });
});

describe('normalizeAlarms', () => {
  it('전체 줄과 "제외한 지역" 줄은 기본 단계, 일부 지역 줄은 아니다', () => {
    const rows = normalizeAlarms([
      raw('TH', '3', '일부', '송클라 주 남부 말레이시아 접경지역, 파타니 주'),
      raw('TH', '2', '일부', '딱 주'),
      raw('TH', '1', '일부', '2.3단계 및 특별여행주의보 발령 지역을 제외한 지역'),
      raw('AE', '3', '전체', '전 지역'),
    ]);
    expect(rows.map((r) => [r.country_code, r.alarm_lvl, r.is_base])).toEqual([
      ['TH', 3, false],
      ['TH', 2, false],
      ['TH', 1, true],
      ['AE', 3, true],
    ]);
  });

  it('지역 줄 안의 괄호 설명 "(…지역 제외)"는 기본 줄로 보지 않고, "수도 니아메 제외 전 지역"은 기본 줄이다', () => {
    const rows = normalizeAlarms([
      raw(
        'EG',
        '3',
        '일부',
        '중•북부 시나이 반도(1,2단계 지역 제외), 리비아 국경으로부터 30km까지',
      ),
      raw('NE', '4', '일부', '수도 니아메 제외 전 지역'),
    ]);
    expect(rows.map((r) => r.is_base)).toEqual([false, true]);
  });

  it('단계가 범위 밖이거나 나라 코드가 없는 줄은 버린다', () => {
    expect(
      normalizeAlarms([
        raw('XX', '0', '전체', '전 지역'),
        raw('', '2', '전체', '전 지역'),
        { alarm_lvl: 2 },
      ]),
    ).toEqual([]);
    expect(normalizeAlarms(null)).toEqual([]);
  });
});

describe('extractAlarmItems', () => {
  it('정상 응답에서 줄을 꺼내고, 항목이 하나면 배열로 만든다', () => {
    const ok = {
      response: { header: { resultCode: '0' }, body: { items: { item: [{ a: 1 }, { a: 2 }] } } },
    };
    expect(extractAlarmItems(ok)).toHaveLength(2);
    const one = { response: { header: { resultCode: '00' }, body: { items: { item: { a: 1 } } } } };
    expect(extractAlarmItems(one)).toEqual([{ a: 1 }]);
  });

  it('오류 응답은 null', () => {
    expect(
      extractAlarmItems({ OpenAPI_ServiceResponse: { cmmMsgHeader: { returnReasonCode: '30' } } }),
    ).toBeNull();
    expect(extractAlarmItems({ response: { header: { resultCode: '30' } } })).toBeNull();
  });
});
