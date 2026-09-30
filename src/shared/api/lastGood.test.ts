import { afterEach, describe, expect, it, vi } from 'vitest';
import { LAST_GOOD_MAX_AGE_MS, fetchKeepingLastGood, lastGoodOptions, readLastGood, writeLastGood } from './lastGood';

afterEach(() => localStorage.clear());

const DAY = 24 * 60 * 60 * 1000;

describe('lastGood 저장', () => {
  it('3일 안쪽 값은 읽히고, 3일이 지나면 버려진다', () => {
    const t0 = Date.parse('2026-10-01T00:00:00Z');
    writeLastGood('k', { a: 1 }, t0);
    expect(readLastGood('k', t0 + 2 * DAY)).toEqual({ a: 1 });
    expect(readLastGood('k', t0 + LAST_GOOD_MAX_AGE_MS)).toEqual({ a: 1 });
    expect(readLastGood('k', t0 + LAST_GOOD_MAX_AGE_MS + 1000)).toBeUndefined();
    expect(localStorage.getItem('triptic-last-good:k')).toBeNull(); // 오래된 건 지운다
  });

  it('깨진 값·없는 값·시계가 거꾸로 간 값은 undefined', () => {
    expect(readLastGood('none')).toBeUndefined();
    localStorage.setItem('triptic-last-good:bad', '{not json');
    expect(readLastGood('bad')).toBeUndefined();
    const now = Date.now();
    writeLastGood('future', 1, now + 10 * DAY);
    expect(readLastGood('future', now)).toBeUndefined();
  });

  it('lastGoodOptions는 저장된 값을 시작 값으로', () => {
    writeLastGood('o', [1, 2, 3]);
    expect(lastGoodOptions<number[]>('o').initialData()).toEqual([1, 2, 3]);
    expect(lastGoodOptions('missing').initialData()).toBeUndefined();
  });
});

describe('fetchKeepingLastGood', () => {
  it('잘 받으면 저장하고 돌려준다', async () => {
    const value = await fetchKeepingLastGood('deals', async () => [1, 2]);
    expect(value).toEqual([1, 2]);
    expect(readLastGood('deals')).toEqual([1, 2]);
  });

  it('받기에 실패하면 그대로 던지고 이전 값은 지우지 않는다', async () => {
    writeLastGood('deals', [9]);
    await expect(fetchKeepingLastGood('deals', async () => { throw new Error('down'); })).rejects.toThrow('down');
    expect(readLastGood('deals')).toEqual([9]);
  });

  it('빈 값이 오면 이전 값이 있을 때는 오류로 쳐서 이전 값을 지킨다', async () => {
    writeLastGood('deals', [9]);
    await expect(fetchKeepingLastGood<number[]>('deals', async () => [], { isEmpty: (v) => v.length === 0 })).rejects.toThrow('keeping');
    expect(readLastGood('deals')).toEqual([9]);
  });

  it('이전 값이 없으면 빈 값도 그대로 돌려준다(진짜 비어 있는 것)', async () => {
    const value = await fetchKeepingLastGood<number[]>('fresh', async () => [], { isEmpty: (v) => v.length === 0 });
    expect(value).toEqual([]);
    expect(readLastGood('fresh')).toBeUndefined(); // 빈 값은 저장하지 않는다
  });

  it('merge로 이전 값과 합친다', async () => {
    writeLastGood('w', { a: 1, b: 2 });
    const value = await fetchKeepingLastGood<Record<string, number>>('w', async () => ({ b: 3 }), { merge: (prev, fresh) => ({ ...prev, ...fresh }) });
    expect(value).toEqual({ a: 1, b: 3 });
    expect(readLastGood('w')).toEqual({ a: 1, b: 3 });
  });

  it('fetcher가 호출되는지(네트워크 없이)', async () => {
    const fetcher = vi.fn().mockResolvedValue('x');
    await fetchKeepingLastGood('call', fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
