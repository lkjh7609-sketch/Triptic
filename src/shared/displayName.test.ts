import { describe, expect, it } from 'vitest';
import { isValidDisplayName } from './displayName';

describe('isValidDisplayName', () => {
  it('한국어·영어·일본어·번체 이름을 받는다', () => {
    for (const name of ['김철수', 'Ben', 'Ben Lee', 'José', 'さくら', '小明', '陳小明', 'a1', 'travel_lover', 'abcdefghijklmnop']) {
      expect(isValidDisplayName(name), name).toBe(true);
    }
  });

  it('너무 짧거나 길면 막는다', () => {
    expect(isValidDisplayName('a')).toBe(false);
    expect(isValidDisplayName('가')).toBe(false);
    expect(isValidDisplayName('abcdefghijklmnopq')).toBe(false);
  });

  it('앞뒤 공백·연속 공백·기호·이모지는 막는다', () => {
    for (const name of [' Ben', 'Ben ', 'a  b', '<b>', 'Ben!', '😀😀', '.Ben', 'Ben-']) {
      expect(isValidDisplayName(name), name).toBe(false);
    }
  });
});
