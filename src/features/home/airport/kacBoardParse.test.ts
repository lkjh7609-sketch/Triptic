import { describe, expect, it } from 'vitest';
import { normalizeKacBoard } from './kacBoardParse';

// 2026-10-04 실제 응답에서 줄인 것
const row = (over: Record<string, unknown>) => ({
  boardingKor: '서울/김포',
  arrivedKor: '제주',
  airlineKorean: '대한항공',
  airFln: 'KE5213',
  std: '1900',
  etd: '1919',
  io: 'O',
  line: '국내',
  gate: '6',
  rmkKor: '출발',
  city: 'CJU',
  airport: 'GMP',
  ...over,
});

describe('normalizeKacBoard', () => {
  it('공항별 출발·도착으로 나누고, 공동운항(같은 시각·상대 공항·게이트)은 한 줄로 — 대표는 편명 번호가 작은 편', () => {
    const boards = normalizeKacBoard([
      row({}),
      row({ airlineKorean: '진에어', airFln: 'LJ513' }),
      row({ airlineKorean: '트리니티항공', airFln: 'TW735', etd: '1921', gate: '18' }),
      row({ io: 'I', airFln: '7C130', airlineKorean: '제주항공', boardingKor: '제주', arrivedKor: '서울/김포', std: '1900', etd: '1911', gate: '4', rmkKor: '도착' }),
      row({ airport: 'TAE', airFln: 'TW664', io: 'I', line: '국제', boardingKor: '타이페이/타오위안', city: 'TPE', std: '0525', etd: '0507', gate: '1', rmkKor: '도착' }),
    ]);
    expect(Object.keys(boards).sort()).toEqual(['GMP', 'TAE']);
    const dep = boards.GMP.departures;
    expect(dep.map((f) => f.id)).toEqual(['LJ513', 'TW735']);
    expect(dep[0]).toMatchObject({ airline: '진에어', city: '제주', airportCode: 'CJU', terminal: 'DOM', gate: '6', scheduled: '1900', estimated: '1919', remark: '출발' });
    expect(dep[0].codeshares).toEqual([{ id: 'KE5213', airline: '대한항공' }]);
    // 도착편은 출발지 이름, 게이트는 gate 칸
    expect(boards.GMP.arrivals[0]).toMatchObject({ id: '7C130', city: '제주', gate: '4', carousel: '' });
    expect(boards.TAE.arrivals[0]).toMatchObject({ terminal: 'INTL', city: '타이페이/타오위안', airportCode: 'TPE' });
  });

  it('변경 시각·상태가 없으면 예정 시각·빈 상태로, 묶음 안에 상태가 있는 편이 있으면 그 상태로', () => {
    const boards = normalizeKacBoard([
      row({ airFln: 'ZE233', etd: null, rmkKor: null, std: '1930', gate: '20' }),
      row({ airFln: 'KE1000', etd: null, rmkKor: null, std: '2000', gate: '3' }),
      row({ airFln: 'OZ9000', etd: null, rmkKor: '지연', std: '2000', gate: '3' }),
    ]);
    const [a, b] = boards.GMP.departures;
    expect(a).toMatchObject({ id: 'ZE233', estimated: '1930', remark: '' });
    expect(b).toMatchObject({ id: 'KE1000', remark: '지연' });
  });

  it('모양이 틀린 줄(방향·편명·시각 없음)은 버리고, 같은 편명이 두 번 와도 한 번만', () => {
    const boards = normalizeKacBoard([row({ io: 'X' }), row({ airFln: '' }), row({ std: '99' }), row({}), row({})]);
    expect(boards.GMP.departures).toHaveLength(1);
    expect(boards.GMP.departures[0].codeshares).toEqual([]);
  });
});
