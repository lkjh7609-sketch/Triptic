import { afterEach, describe, expect, it } from 'vitest';
import { markFirstTripGuideAnswered, shouldAskFirstTripGuide } from './firstTripGuide';

afterEach(() => localStorage.clear());

describe('shouldAskFirstTripGuide', () => {
  it('로그인한 회원이 여행이 없고 아직 답하지 않았을 때만 묻는다', () => {
    expect(shouldAskFirstTripGuide('u1', 0, false)).toBe(true);
    expect(shouldAskFirstTripGuide(null, 0, false)).toBe(false);
    expect(shouldAskFirstTripGuide('u1', 2, false)).toBe(false);
    expect(shouldAskFirstTripGuide('u1', 0, true)).toBe(false);
  });

  it('한 번 답하면 다시 묻지 않고, 회원마다 따로 기록한다', () => {
    markFirstTripGuideAnswered('u1');
    expect(shouldAskFirstTripGuide('u1', 0, false)).toBe(false);
    expect(shouldAskFirstTripGuide('u2', 0, false)).toBe(true);
  });
});
