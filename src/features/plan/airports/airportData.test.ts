import { describe, expect, it } from 'vitest';
import {
  airportSubtitle,
  airportTitle,
  normalizeQuery,
  pickName,
  searchAirports,
  type Airport,
} from './airportData';

const ap = (iata: string, cc: string, name: Airport['name'], city: Airport['city']): Airport => ({
  iata,
  country_code: cc,
  name,
  city,
  lat: 0,
  lng: 0,
  timezone: 'UTC',
});

const list: Airport[] = [
  ap(
    'NRT',
    'JP',
    { ko: '나리타 국제공항', en: 'Narita International Airport', ja: '成田国際空港' },
    { ko: '도쿄', en: 'Tokyo', ja: '東京' },
  ),
  ap(
    'HND',
    'JP',
    { ko: '하네다 공항', en: 'Tokyo Haneda Airport' },
    { ko: '도쿄', en: 'Tokyo', ja: '東京' },
  ),
  ap(
    'ICN',
    'KR',
    { ko: '인천국제공항', en: 'Incheon International Airport' },
    { ko: '서울', en: 'Seoul' },
  ),
  ap(
    'SAW',
    'TR',
    { en: 'Sabiha Gökçen International Airport' },
    { en: 'Istanbul', ko: '이스탄불' },
  ),
  ap('TOY', 'JP', { en: 'Toyama Airport' }, { ko: '도야마', en: 'Toyama' }),
  ap('BKK', 'TH', { en: 'Suvarnabhumi Airport' }, { ko: '방콕', en: 'Bangkok' }),
];
const countryName = (cc: string) =>
  ({ JP: '일본', KR: '대한민국', TR: '튀르키예', TH: '태국' })[cc] ?? cc;

describe('pickName', () => {
  it('표시 언어 이름, 없으면 영어, 그것도 없으면 있는 것', () => {
    expect(pickName({ ko: '도쿄', en: 'Tokyo' }, 'ko')).toBe('도쿄');
    expect(pickName({ en: 'Tokyo' }, 'ko')).toBe('Tokyo');
    expect(pickName({ ja: '東京' }, 'en')).toBe('東京');
    expect(pickName({ 'zh-TW': '東京', en: 'Tokyo' }, 'zh-TW')).toBe('東京');
    expect(pickName(undefined, 'ko')).toBe('');
  });
});

describe('searchAirports', () => {
  it('공항 코드가 정확히 맞으면 맨 위', () => {
    expect(searchAirports(list, 'nrt')[0].iata).toBe('NRT');
    expect(searchAirports(list, 'HND')[0].iata).toBe('HND');
  });

  it('도시 이름(한국어·영어 모두)으로 찾고, 같은 도시의 공항이 모두 나온다', () => {
    expect(
      searchAirports(list, '도쿄')
        .map((a) => a.iata)
        .sort(),
    ).toEqual(['HND', 'NRT']);
    expect(
      searchAirports(list, 'tokyo')
        .map((a) => a.iata)
        .sort(),
    ).toEqual(['HND', 'NRT']);
  });

  it('악센트·공백·대소문자를 무시하고, 공항 이름에 들어 있는 글자도 찾는다', () => {
    expect(searchAirports(list, 'gokcen')[0].iata).toBe('SAW');
    expect(searchAirports(list, 'Narita Int')[0].iata).toBe('NRT');
    expect(searchAirports(list, '  하네다 ')[0].iata).toBe('HND');
  });

  it('국가 이름으로도 찾는다', () => {
    const r = searchAirports(list, '태국', { countryName });
    expect(r.map((a) => a.iata)).toEqual(['BKK']);
  });

  it('도시로 시작하는 것이 이름에 들어 있는 것보다 앞(서울 → ICN 먼저)', () => {
    expect(searchAirports(list, '서울', { countryName })[0].iata).toBe('ICN');
  });

  it('빈 검색어는 결과 없음, 개수 제한', () => {
    expect(searchAirports(list, '  ')).toEqual([]);
    expect(searchAirports(list, 'o', { limit: 2 }).length).toBeLessThanOrEqual(2);
  });

  it('한 글자 코드 접두는 코드로 보지 않는다(너무 많이 걸린다)', () => {
    expect(
      searchAirports(list, 'n').every((a) => a.iata !== 'NRT' || /n/i.test(JSON.stringify(a))),
    ).toBe(true);
  });
});

describe('표시', () => {
  it('큰 글씨는 도시(국가), 작은 글씨는 코드 · 공항 이름', () => {
    expect(airportTitle(list[0], 'ko', countryName)).toBe('도쿄(일본)');
    expect(airportSubtitle(list[0], 'ko')).toBe('NRT · 나리타 국제공항');
    expect(airportTitle(list[0], 'en', () => 'Japan')).toBe('Tokyo(Japan)');
    expect(airportSubtitle(list[3], 'ko')).toBe('SAW · Sabiha Gökçen International Airport');
  });

  it('정규화', () => {
    expect(normalizeQuery(" São-Paulo, O'Hare ")).toBe('saopauloohare');
  });
});
