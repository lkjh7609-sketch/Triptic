import { describe, expect, it } from 'vitest';
import { SAMPLE_TRIP_ID } from '@/features/plan/sampleTrip';
import { requiresLogin } from './guestAccess';

describe('requiresLogin — PC 비로그인 둘러보기', () => {
  it.each([
    '/',
    '/flights',
    '/hotels',
    '/activities',
    '/plan',
    '/community',
    '/community/d/tokyo',
    '/community/post/p1',
    '/community/post/p1/trip',
    '/community/user/u1',
    '/community/companion/c1',
    `/plan/${SAMPLE_TRIP_ID}`,
  ])('%s 는 로그인 없이 볼 수 있다', (path) => {
    expect(requiresLogin(path)).toBe(false);
  });

  it.each([
    '/settings',
    '/settings/',
    '/community/compose',
    '/community/companion/new',
    '/community/companion/c1/match',
    '/community/companion/c1/chat',
    '/community/companion/c1/expenses',
    '/plan/7b0c-trip',
  ])('%s 는 로그인해야 한다', (path) => {
    expect(requiresLogin(path)).toBe(true);
  });
});
