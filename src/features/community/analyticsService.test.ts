import { describe, it, expect } from 'vitest';
import { formatLastSeen } from './analyticsService';

describe('formatLastSeen', () => {
  const now = Date.parse('2026-09-30T12:00:00Z');
  it('PostHog UTC 시각을 상대 시각으로', () => {
    expect(formatLastSeen('2026-09-30 09:00:00', 'en', now)).toBe('3 hours ago');
    expect(formatLastSeen('2026-09-28T12:00:00Z', 'en', now)).toBe('2 days ago');
    expect(formatLastSeen('2026-09-30 11:30:00', 'en', now)).toBe('30 minutes ago');
  });
  it('없거나 읽을 수 없으면 null', () => {
    expect(formatLastSeen(null, 'ko', now)).toBeNull();
    expect(formatLastSeen('nope', 'ko', now)).toBeNull();
  });
});
