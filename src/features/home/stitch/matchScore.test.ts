import { describe, expect, it } from 'vitest';
import { matchScore } from './matchScore';

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
});
