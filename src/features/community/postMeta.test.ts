import { describe, expect, it } from 'vitest';
import { isPostCategory, normalizeTag, normalizeTags } from './postMeta';

describe('postMeta', () => {
  it('분류는 고정된 네 가지뿐', () => {
    expect(isPostCategory('story')).toBe(true);
    expect(isPostCategory('qna')).toBe(true);
    expect(isPostCategory('tips')).toBe(true);
    expect(isPostCategory('food')).toBe(true);
    expect(isPostCategory('companion')).toBe(false);
    expect(isPostCategory(undefined)).toBe(false);
  });

  it('태그는 #·앞뒤 공백을 떼고 연속 공백을 하나로, 비었거나 20자 넘으면 버린다', () => {
    expect(normalizeTag('  #바투  동굴 ')).toBe('바투 동굴');
    expect(normalizeTag('##')).toBeNull();
    expect(normalizeTag('')).toBeNull();
    expect(normalizeTag('가'.repeat(20))).toBe('가'.repeat(20));
    expect(normalizeTag('가'.repeat(21))).toBeNull();
  });

  it('목록은 중복(대소문자 무시)을 처음 것만 남기고 3개까지', () => {
    expect(normalizeTags(['#KLIA', 'klia', ' ', '바투동굴', '#Grab', '넷째'])).toEqual([
      'KLIA',
      '바투동굴',
      'Grab',
    ]);
  });
});
