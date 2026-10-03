import { describe, expect, it } from 'vitest';
import { airlineDisplayName, hasAirlineNames } from './airlineNames';
import { flightAirlineLabel } from '../flights';

describe('airlineDisplayName', () => {
  it('한국어는 저장된 이름 그대로, 영어·일본어·번체는 공식 이름', () => {
    expect(airlineDisplayName('KE', 'ko', '대한항공')).toBe('대한항공');
    expect(airlineDisplayName('KE', 'en', '대한항공')).toBe('Korean Air');
    expect(airlineDisplayName('JL', 'ja', '일본항공')).toBe('日本航空');
    expect(airlineDisplayName('BR', 'zh-TW', '에바항공')).toBe('長榮航空');
  });

  it('일본어·번체 이름이 없는 항공사는 영어, 코드가 없거나 표에 없으면 저장된 이름', () => {
    expect(airlineDisplayName('YP', 'ja', '에어프레미아')).toBe('Air Premia');
    expect(airlineDisplayName('YP', 'zh-TW', '에어프레미아')).toBe('Air Premia');
    expect(airlineDisplayName(undefined, 'en', '직접 입력 항공')).toBe('직접 입력 항공');
    expect(airlineDisplayName('QQ', 'en', '모르는 항공')).toBe('모르는 항공');
    expect(airlineDisplayName('kE', 'en', '')).toBe('Korean Air');
  });

  it('인천 시즌 스케줄의 항공사 코드가 표에 들어 있다', () => {
    for (const code of [
      'KE',
      'OZ',
      '7C',
      'LJ',
      'TW',
      'BX',
      'RS',
      'ZE',
      'YP',
      'WE',
      'RF',
      '4V',
      '3U',
      'ZH',
    ]) {
      expect(hasAirlineNames(code)).toBe(true);
    }
  });
});

describe('flightAirlineLabel', () => {
  it('항공편의 코드와 한국어 이름으로 표시 언어에 맞는 이름을 만든다', () => {
    expect(flightAirlineLabel({ airline: '대한항공', airlineCode: 'KE' }, 'en')).toBe('Korean Air');
    expect(flightAirlineLabel({ airline: '직접 입력', airlineCode: undefined }, 'en')).toBe(
      '직접 입력',
    );
  });
});
