import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { isPersistableData, shouldPersistQuery } from './persister';

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

describe('shouldPersistQuery — AI 소개의 null은 저장하지 않는다', () => {
  function queryOf(key: unknown[], data: unknown) {
    const client = new QueryClient();
    client.setQueryData(key, data);
    return client.getQueryCache().find({ queryKey: key })!;
  }
  it('소개가 있으면 저장, 없음(null)이면 저장 안 함', () => {
    expect(shouldPersistQuery(queryOf(['ai', 'cityDesc', 'ko', 'kyoto'], '교토는…'))).toBe(true);
    expect(shouldPersistQuery(queryOf(['ai', 'cityDesc', 'ko', 'kyoto'], null))).toBe(false);
  });
  it('AI가 아닌 쿼리의 null은 그대로 저장한다', () => {
    expect(shouldPersistQuery(queryOf(['profile', 'u1'], null))).toBe(true);
  });
  it('Map이 든 결과는 저장하지 않는다', () => {
    expect(shouldPersistQuery(queryOf(['x'], new Map([['a', 1]])))).toBe(false);
  });
});
