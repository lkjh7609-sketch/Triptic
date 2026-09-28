import { describe, expect, it } from 'vitest';
import { cityDisplayName } from './cityName';

describe('cityDisplayName', () => {
  it.each([
    ['오스트레일리아 뉴사우스웨일스 주 시드니', '시드니'],
    ['미국 뉴욕 주 뉴욕', '뉴욕'],
    ['프랑스 파리', '파리'],
    ['일본 도쿄도', '도쿄도'],
    ['Sydney NSW, Australia', 'Sydney'],
    ['New York, NY, USA', 'New York'],
    ['Tokyo, Japan', 'Tokyo'],
    ['日本、東京都', '東京都'],
    ['시드니', '시드니'],
    ['New York', 'New York'],
    ['', ''],
  ])('%s → %s', (input, expected) => {
    expect(cityDisplayName(input)).toBe(expected);
  });
});
