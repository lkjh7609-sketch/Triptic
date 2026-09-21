import { describe, expect, it } from 'vitest';
import { particle } from './particle';

describe('particle', () => {
  it('받침 있는 단어는 withBatchim을 반환한다', () => {
    expect(particle('부산', '을', '를')).toBe('을');
    expect(particle('서울', '을', '를')).toBe('을');
  });

  it('받침 없는 단어는 without을 반환한다', () => {
    expect(particle('도쿄', '을', '를')).toBe('를');
    expect(particle('오사카', '을', '를')).toBe('를');
  });

  it('한글이 아닌 단어는 without을 반환한다', () => {
    expect(particle('Tokyo', '을', '를')).toBe('를');
    expect(particle('KE801', '을', '를')).toBe('를');
  });

  it('빈 문자열은 without을 반환한다', () => {
    expect(particle('', '을', '를')).toBe('를');
    expect(particle('   ', '을', '를')).toBe('를');
  });
});
