import { describe, expect, it } from 'vitest';
import { widgetLanguage } from './HotelSearchWidget';

describe('웹 검색 위젯 언어 — 앱 표시 언어를 따른다', () => {
  it('언어별 코드', () => {
    expect(widgetLanguage('ko')).toBe('ko-kr');
    expect(widgetLanguage('ko-KR')).toBe('ko-kr');
    expect(widgetLanguage('en')).toBe('en-us');
    expect(widgetLanguage('ja')).toBe('ja-jp');
    expect(widgetLanguage('zh-TW')).toBe('zh-tw');
    expect(widgetLanguage('zh-Hant')).toBe('zh-tw');
  });
  it('모르는 언어는 영어', () => {
    expect(widgetLanguage('fr')).toBe('en-us');
  });
});
