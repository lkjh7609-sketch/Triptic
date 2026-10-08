import { describe, expect, it } from 'vitest';
import { isPersistableData } from './persister';

describe('isPersistableData — JSON 캐시에 넣으면 모양이 바뀌는 값(Map·Set)은 저장하지 않는다', () => {
  it('일반 값·배열·객체는 저장한다', () => {
    expect(isPersistableData(undefined)).toBe(true);
    expect(isPersistableData(null)).toBe(true);
    expect(isPersistableData('x')).toBe(true);
    expect(isPersistableData([{ id: 'a', tags: ['x'] }])).toBe(true);
    expect(isPersistableData({ a: { b: [1, 2] } })).toBe(true);
  });

  it('Map·Set은 맨 위든 안쪽이든 저장하지 않는다', () => {
    expect(isPersistableData(new Map([['a', 'Kyoto']]))).toBe(false);
    expect(isPersistableData(new Set(['a']))).toBe(false);
    expect(isPersistableData({ names: new Map() })).toBe(false);
    expect(isPersistableData([{ liked: new Set() }])).toBe(false);
  });
});
