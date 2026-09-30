import { describe, expect, it } from 'vitest';
import { relativeTime } from './relativeTime';

const NOW = Date.parse('2026-10-01T12:00:00Z');

describe('relativeTime', () => {
  it('10분 전·2일 전·1주 전을 한국어로', () => {
    expect(relativeTime('2026-10-01T11:50:00Z', 'ko', NOW)).toBe('10분 전');
    expect(relativeTime('2026-09-29T12:00:00Z', 'ko', NOW)).toBe('2일 전');
    expect(relativeTime('2026-09-24T12:00:00Z', 'ko', NOW)).toBe('1주 전');
  });

  it('1분 미만은 지금', () => {
    expect(relativeTime('2026-10-01T11:59:40Z', 'ko', NOW)).toBe('지금');
  });

  it('영어도 된다', () => {
    expect(relativeTime('2026-10-01T09:00:00Z', 'en', NOW)).toBe('3 hours ago');
  });
});
