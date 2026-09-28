import { describe, expect, it } from 'vitest';
import { checkPassword, isPasswordValid } from './passwordRules';

describe('isPasswordValid', () => {
  it('8~15자 + 대문자 + 숫자면 통과', () => {
    expect(isPasswordValid('Abcdefg1')).toBe(true);
    expect(isPasswordValid('Abcdefghijklmn1')).toBe(true);
    expect(isPasswordValid('abcdeF1!')).toBe(true);
  });

  it('길이 경계: 7자 실패, 16자 실패', () => {
    expect(isPasswordValid('Abcdef1')).toBe(false);
    expect(isPasswordValid('Abcdefghijklmno1')).toBe(false);
  });

  it('대문자 또는 숫자가 없으면 실패', () => {
    expect(isPasswordValid('abcdefg1')).toBe(false);
    expect(isPasswordValid('Abcdefgh')).toBe(false);
  });

  it('항목별 결과를 돌려준다', () => {
    expect(checkPassword('abc')).toEqual({ length: false, upper: false, digit: false });
    expect(checkPassword('Abcdefg1')).toEqual({ length: true, upper: true, digit: true });
  });
});
