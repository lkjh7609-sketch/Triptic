import { describe, expect, it } from 'vitest';
import { detectLanguage } from './languageDetect';

describe('detectLanguage', () => {
  it('한글이 포함되면 ko', () => {
    expect(detectLanguage('도쿄 여행 정말 좋았어요')).toBe('ko');
  });

  it('한자만 있으면 zh-TW', () => {
    expect(detectLanguage('東京旅行很開心')).toBe('zh-TW');
  });

  it('가나가 섞인 일본어는 한자가 있어도 ja로 본다', () => {
    expect(detectLanguage('東京の旅行はとても楽しかった')).toBe('ja');
  });

  it('그 외는 en으로 폴백한다', () => {
    expect(detectLanguage('This trip to Tokyo was amazing')).toBe('en');
  });
});
