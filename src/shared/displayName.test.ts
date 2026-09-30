import { describe, expect, it } from 'vitest';
import { isValidDisplayName, nameScript } from './displayName';

describe('nameScript', () => {
  it('한글 > 가나 > 한자 > 그 밖 순서로 정한다', () => {
    expect(nameScript('김철수님')).toBe('hangul');
    expect(nameScript('Ben철수')).toBe('hangul');
    expect(nameScript('さくらさん')).toBe('kana');
    expect(nameScript('田中たろう')).toBe('kana');
    expect(nameScript('陳小明')).toBe('han');
    expect(nameScript('小明Ben')).toBe('han');
    expect(nameScript('Ben Lee')).toBe('other');
  });
});

describe('isValidDisplayName — 언어별 글자 수', () => {
  it('한글은 4~8자', () => {
    expect(isValidDisplayName('김철수')).toBe(false);
    expect(isValidDisplayName('김철수님')).toBe(true);
    expect(isValidDisplayName('가나다라마바사아')).toBe(true);
    expect(isValidDisplayName('가나다라마바사아자')).toBe(false);
  });

  it('영어는 4~12자(공백 포함해서 센다)', () => {
    expect(isValidDisplayName('Ben')).toBe(false);
    expect(isValidDisplayName('Beni')).toBe(true);
    expect(isValidDisplayName('Ben Lee')).toBe(true);
    expect(isValidDisplayName('abcdefghijkl')).toBe(true);
    expect(isValidDisplayName('abcdefghijklm')).toBe(false);
  });

  it('일본어는 4~12자', () => {
    expect(isValidDisplayName('さくら')).toBe(false);
    expect(isValidDisplayName('さくらさん')).toBe(true);
    expect(isValidDisplayName('さくらさくらさくら')).toBe(true);
    expect(isValidDisplayName('さくらさくらさくらさくらさ')).toBe(false);
  });

  it('중국어(한자만)는 2~6자', () => {
    expect(isValidDisplayName('小')).toBe(false);
    expect(isValidDisplayName('小明')).toBe(true);
    expect(isValidDisplayName('陳小明陳小明')).toBe(true);
    expect(isValidDisplayName('陳小明陳小明陳')).toBe(false);
  });

  it('앞뒤 공백·연속 공백·기호·이모지는 막는다', () => {
    for (const name of [' Beni', 'Beni ', 'Be  ni', '<b>oy', 'Beni!', '😀😀😀😀', '.Beni', 'Beni-']) {
      expect(isValidDisplayName(name), name).toBe(false);
    }
  });
});
