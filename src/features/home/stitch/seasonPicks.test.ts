import { describe, expect, it } from 'vitest';
import { rankSeasonCandidates, seasonKind, type MonthStat, type SeasonRow } from './seasonPicks';

const stat = (tmax: number): MonthStat => [tmax, tmax - 8, 60, 6];
const year = (tmax: number) => Array.from({ length: 12 }, () => stat(tmax));
const row = (slug: string, over: Partial<SeasonRow['destination']> = {}, best = [10], tmax = 22): SeasonRow => ({
  best_months: best,
  monthly: year(tmax),
  destination: { id: slug, slug, country_code: 'JP', lat: 1, lng: 2, cover_url: null, is_featured: false, sort_order: 100, ...over },
});

describe('seasonKind — 그 달 평균 최고기온으로 배지 종류', () => {
  it('27도 이상 warm, 17~27 pleasant, 그보다 낮으면 cool', () => {
    expect(seasonKind(stat(30))).toBe('warm');
    expect(seasonKind(stat(27))).toBe('warm');
    expect(seasonKind(stat(22))).toBe('pleasant');
    expect(seasonKind(stat(17))).toBe('pleasant');
    expect(seasonKind(stat(9))).toBe('cool');
  });
});

describe('rankSeasonCandidates — 이번 달이 가기 좋은 달인 도시', () => {
  it('이번 달이 best_months에 든 도시만, 인기 먼저·정렬 순서대로', () => {
    const rows = [
      row('plain-a', { sort_order: 1 }),
      row('pop-b', { is_featured: true, sort_order: 5 }),
      row('pop-a', { is_featured: true, sort_order: 2 }),
      row('other-month', { is_featured: true, sort_order: 1 }, [4]),
    ];
    expect(rankSeasonCandidates(rows, 10).map((c) => c.slug)).toEqual(['pop-a', 'pop-b', 'plain-a']);
  });

  it('최대 6곳(기본)', () => {
    const rows = Array.from({ length: 10 }, (_, i) => row(`c${i}`, { sort_order: i }));
    expect(rankSeasonCandidates(rows, 10)).toHaveLength(6);
    expect(rankSeasonCandidates(rows, 10, 3)).toHaveLength(3);
  });

  it('그 달 기후 값이 없거나 깨진 도시는 건너뛴다', () => {
    const broken = row('broken');
    broken.monthly[9] = null;
    const nan = row('nan');
    nan.monthly[9] = [NaN, 1, 1, 1];
    expect(rankSeasonCandidates([broken, nan, row('ok')], 10).map((c) => c.slug)).toEqual(['ok']);
  });

  it('그 달의 기후와 배지 종류를 담는다', () => {
    const [c] = rankSeasonCandidates([row('hot', {}, [10], 31)], 10);
    expect(c).toMatchObject({ slug: 'hot', kind: 'warm', stat: [31, 23, 60, 6], country: 'JP' });
  });
});
