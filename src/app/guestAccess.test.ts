import { describe, expect, it } from 'vitest';
import { SAMPLE_TRIP_ID } from '@/features/plan/sampleTrip';
import { requiresLogin } from './guestAccess';

describe('requiresLogin — 비로그인 둘러보기(커뮤니티는 회원 전용)', () => {
  it.each([
    '/',
    '/flights',
    '/hotels',
    '/activities',
    '/plan',
    '/notices',
    '/guide',
    `/plan/${SAMPLE_TRIP_ID}`,
  ])('%s 는 로그인 없이 볼 수 있다', (path) => {
    expect(requiresLogin(path)).toBe(false);
  });

  it.each([
    '/settings',
    '/settings/',
    '/community',
    '/community/',
    '/community/d/tokyo',
    '/community/board',
    '/community/post/p1',
    '/community/post/p1/trip',
    '/community/user/u1',
    '/community/companion/c1',
    '/community/compose',
    '/community/post/p1/edit',
    '/community/companion/new',
    '/community/companion/c1/match',
    '/community/companion/c1/chat',
    '/community/companion/c1/expenses',
    '/plan/7b0c-trip',
  ])('%s 는 로그인해야 한다', (path) => {
    expect(requiresLogin(path)).toBe(true);
  });
});
