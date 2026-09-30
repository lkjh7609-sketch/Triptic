import { describe, it, expect } from 'vitest';
import { shouldReloadForChunkError, GLOBAL_RELOAD_COOLDOWN_MS } from './chunkRetry';

describe('shouldReloadForChunkError', () => {
  const err = new TypeError('Importing a module script failed.');
  it('청크 로드 실패면 새로고침한다', () => {
    expect(shouldReloadForChunkError(err, null)).toBe(true);
    expect(shouldReloadForChunkError(new Error('Failed to fetch dynamically imported module: https://x/a.js'), null)).toBe(true);
  });
  it('다른 에러는 무시한다', () => {
    expect(shouldReloadForChunkError(new Error('boom'), null)).toBe(false);
    expect(shouldReloadForChunkError(undefined, null)).toBe(false);
  });
  it('쿨다운 안에서는 다시 새로고침하지 않는다', () => {
    const now = 1_000_000;
    expect(shouldReloadForChunkError(err, now - 1000, now)).toBe(false);
    expect(shouldReloadForChunkError(err, now - GLOBAL_RELOAD_COOLDOWN_MS - 1, now)).toBe(true);
  });
});
