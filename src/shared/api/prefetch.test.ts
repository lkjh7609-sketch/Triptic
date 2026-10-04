import { afterEach, describe, expect, it } from 'vitest';
import { takePrefetch } from './prefetch';

afterEach(() => {
  delete window.__prefetch;
});

describe('takePrefetch', () => {
  it('미리 시작해 둔 요청의 결과를 돌려주고, 한 번 가져가면 지운다', async () => {
    window.__prefetch = { a: Promise.resolve({ items: [1] }) };
    expect(await takePrefetch('a')).toEqual({ items: [1] });
    expect(await takePrefetch('a')).toBeNull();
  });

  it('없거나 키가 다르면 null — 호출한 쪽이 새로 받는다', async () => {
    expect(await takePrefetch('a')).toBeNull();
    window.__prefetch = { a: Promise.resolve(1) };
    expect(await takePrefetch('b')).toBeNull();
    expect(window.__prefetch.a).toBeDefined();
  });

  it('미리 한 요청이 실패했으면 null', async () => {
    window.__prefetch = { a: Promise.reject(new Error('net')) };
    expect(await takePrefetch('a')).toBeNull();
  });
});
