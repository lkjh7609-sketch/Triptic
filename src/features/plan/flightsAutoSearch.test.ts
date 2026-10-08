import { beforeEach, describe, expect, it } from 'vitest';
import { flightFromParams, markFlightsAutoSearch, takeFlightsAutoSearch } from './flightsAutoSearch';

const TODAY = '2026-10-09';
const p = (qs: string) => new URLSearchParams(qs);

describe('자동 검색 표시', () => {
  beforeEach(() => sessionStorage.clear());

  it('한 번 읽으면 지워진다', () => {
    expect(takeFlightsAutoSearch()).toBe(false);
    markFlightsAutoSearch();
    expect(takeFlightsAutoSearch()).toBe(true);
    expect(takeFlightsAutoSearch()).toBe(false);
  });
});

describe('flightFromParams — 항공 탭 주소 → 검색 조건', () => {
  it('왕복: 코드는 대문자로, 인원은 한도 안으로', () => {
    expect(flightFromParams(p('origin=sel&destination=osa&depart_date=2026-11-10&return_date=2026-11-15&adults=2&children=1&infants=1'), TODAY)).toEqual({
      origin: 'SEL',
      originType: 'city',
      destination: 'OSA',
      destinationType: 'city',
      departDate: '2026-11-10',
      returnDate: '2026-11-15',
      adults: 2,
      children: 1,
      infants: 1,
    });
  });

  it('편도(귀국일 없음)·기본 인원', () => {
    expect(flightFromParams(p('origin=ICN&destination=NRT&depart_date=2026-10-09'), TODAY)).toMatchObject({ returnDate: null, adults: 1, children: 0, infants: 0 });
  });

  it('유아는 성인 수까지, 아동은 좌석 9석까지로 줄인다', () => {
    expect(flightFromParams(p('origin=ICN&destination=NRT&depart_date=2026-11-10&adults=2&children=8&infants=5'), TODAY)).toMatchObject({ adults: 2, children: 7, infants: 2 });
  });

  it.each([
    ['출발지가 없다', 'destination=NRT&depart_date=2026-11-10'],
    ['코드가 아니다', 'origin=ICN1&destination=NRT&depart_date=2026-11-10'],
    ['출발=도착', 'origin=ICN&destination=ICN&depart_date=2026-11-10'],
    ['지난 날짜', 'origin=ICN&destination=NRT&depart_date=2026-10-08'],
    ['날짜 형식', 'origin=ICN&destination=NRT&depart_date=11-10'],
    ['귀국일이 출발일보다 이르다', 'origin=ICN&destination=NRT&depart_date=2026-11-10&return_date=2026-11-09'],
  ])('틀린 주소는 null — %s', (_label, qs) => {
    expect(flightFromParams(p(qs), TODAY)).toBeNull();
  });
});
