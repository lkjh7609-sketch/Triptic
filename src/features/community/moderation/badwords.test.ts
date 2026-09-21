import { describe, expect, it } from 'vitest';
import { badwordScore } from './badwords';

describe('badwordScore', () => {
  it('평범한 텍스트는 0을 반환한다', () => {
    expect(badwordScore('오늘 도쿄 여행 정말 즐거웠어요!')).toBe(0);
  });

  it('명백한 금칙어는 1을 반환한다', () => {
    expect(badwordScore('이 씨발 진짜')).toBe(1);
    expect(badwordScore('fuck this trip')).toBe(1);
  });

  it('자소 분리(초성)로 우회한 표현도 걸러낸다', () => {
    expect(badwordScore('ㅅㅂ 진짜 별로였음')).toBe(1);
  });

  it('특수문자·숫자 삽입 우회도 걸러낸다', () => {
    expect(badwordScore('씨1발 이게 뭐야')).toBe(1);
    expect(badwordScore('시 발 진짜')).toBe(1);
  });
});
