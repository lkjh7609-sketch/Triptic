import { describe, expect, it } from 'vitest';
import { detectLanguage } from './languageDetect';

describe('detectLanguage', () => {
  it('한글이 포함되면 ko', () => {
    expect(detectLanguage('도쿄 여행 정말 좋았어요')).toBe('ko');
  });

  it('한자가 포함되면 zh-CN', () => {
    expect(detectLanguage('东京旅行很开心')).toBe('zh-CN');
  });

  it('그 외는 en으로 폴백한다', () => {
    expect(detectLanguage('This trip to Tokyo was amazing')).toBe('en');
  });
});
