import { describe, expect, it } from 'vitest';
import { PING_INTERVAL_MS, shouldPing } from './useActivityPing';

describe('shouldPing', () => {
  it('처음이거나 30분이 지났을 때만 기록한다', () => {
    const now = 1_000_000_000;
    expect(shouldPing(null, now)).toBe(true);
    expect(shouldPing(now - PING_INTERVAL_MS + 1, now)).toBe(false);
    expect(shouldPing(now - PING_INTERVAL_MS, now)).toBe(true);
    expect(shouldPing(Number.NaN, now)).toBe(true);
  });
});
