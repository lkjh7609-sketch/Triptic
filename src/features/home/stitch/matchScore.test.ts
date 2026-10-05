import { describe, expect, it } from 'vitest';
import { demographicFit, matchScore } from './matchScore';

const trip = { city: 'Tokyo, Japan', startDate: '2026-10-10', endDate: '2026-10-14' };

describe('matchScore', () => {
  it('도시·날짜가 모두 같으면 100', () => {
    expect(matchScore({ destinationName: 'Tokyo', startDate: '2026-10-10', endDate: '2026-10-14' }, trip)).toBe(100);
  });

  it('도시만 같으면 50', () => {
    expect(matchScore({ destinationName: 'Tokyo', startDate: '2026-12-01', endDate: '2026-12-03' }, trip)).toBe(50);
  });

  it('날짜가 일부만 겹치면 겹친 만큼 점수', () => {
    // 5일 중 3일이 겹침 → 60%의 50점 = 30 (도시가 달라도 날짜 점수는 준다)
    expect(matchScore({ destinationName: 'Osaka', startDate: '2026-10-12', endDate: '2026-10-16' }, trip)).toBe(30);
    expect(matchScore({ destinationName: null, startDate: '2026-10-08', endDate: '2026-10-12' }, trip)).toBe(30);
  });

  it('맞는 게 하나도 없으면 null(0%를 보여주지 않는다)', () => {
    expect(matchScore({ destinationName: 'Paris', startDate: '2026-12-01', endDate: '2026-12-03' }, trip)).toBeNull();
  });

  it('내 여행 날짜가 없으면 도시만 본다', () => {
    expect(matchScore({ destinationName: 'Tokyo', startDate: '2026-10-10', endDate: '2026-10-14' }, { city: 'Tokyo, Japan', startDate: null, endDate: null })).toBe(50);
  });

  it('날짜 미정(협의) 글은 도시만 본다', () => {
    expect(matchScore({ destinationName: 'Tokyo', startDate: null, endDate: null }, trip)).toBe(50);
    expect(matchScore({ destinationName: 'Paris', startDate: null, endDate: null }, trip)).toBeNull();
  });
});

describe('matchScore — 나이대·성별', () => {
  const tokyo = { destinationName: 'Tokyo', startDate: '2026-10-10', endDate: '2026-10-14' };
  const me = { ageBand: '30s_early', gender: 'male' as const };

  it('글이 건 조건에 내가 맞으면 점수에 20점씩 더한다(도시·날짜가 같으면 그대로 100)', () => {
    expect(matchScore({ ...tokyo, prefAges: ['30s_early'], prefGender: 'male' }, trip, me)).toBe(100);
  });

  it('조건이 안 맞으면 그 칸은 0점으로 계산해 점수가 내려간다', () => {
    // 도시·날짜 60/60 + 나이대 20/20 + 성별 0/20 = 80/100
    expect(matchScore({ ...tokyo, prefAges: ['30s_early'], prefGender: 'female' }, trip, me)).toBe(80);
  });

  it('글이 조건을 안 걸었거나 내 프로필에 값이 없으면 계산에 넣지 않는다', () => {
    expect(matchScore({ ...tokyo, prefAges: [], prefGender: 'any' }, trip, me)).toBe(100);
    expect(matchScore({ ...tokyo, prefAges: ['30s_early'], prefGender: 'female' }, trip, { ageBand: null, gender: null })).toBe(100);
    expect(matchScore({ ...tokyo, prefAges: ['30s_early'], prefGender: 'female' }, trip, null)).toBe(100);
  });

  it('demographicFit — 맞음/안 맞음/판단 불가', () => {
    expect(demographicFit({ ...tokyo, prefAges: ['30s_early'], prefGender: 'male' }, me)).toMatchObject({ matched: 'both', mismatch: false });
    expect(demographicFit({ ...tokyo, prefAges: ['30s_early'] }, me)).toMatchObject({ matched: 'age', mismatch: false });
    expect(demographicFit({ ...tokyo, prefGender: 'male' }, me)).toMatchObject({ matched: 'gender', mismatch: false });
    expect(demographicFit({ ...tokyo, prefAges: ['20s_early'], prefGender: 'male' }, me)).toMatchObject({ matched: null, mismatch: true });
    expect(demographicFit({ ...tokyo, prefAges: [], prefGender: 'any' }, me)).toMatchObject({ matched: null, mismatch: false });
    expect(demographicFit({ ...tokyo, prefAges: ['30s_early'] }, null)).toMatchObject({ matched: null, mismatch: false });
  });
});
