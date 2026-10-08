import { describe, expect, it } from 'vitest';
import { rankSeasonCandidates, seasonKind, type MonthStat, type SeasonClimateTable, type SeasonDestination } from './seasonPicks';
import climate from './seasonClimate.json';

const stat = (tmax: number): MonthStat => [tmax, tmax - 8, 60];
const year = (tmax: number) => Array.from({ length: 12 }, () => stat(tmax));
const dest = (slug: string, over: Partial<SeasonDestination> = {}): SeasonDestination => ({ id: slug, slug, country_code: 'JP', lat: 1, lng: 2, cover_url: null, is_featured: false, sort_order: 100, ...over });
const table = (entries: Record<string, { best?: number[]; tmax?: number }>): SeasonClimateTable =>
  Object.fromEntries(Object.entries(entries).map(([slug, e]) => [slug, { best: e.best ?? [10], monthly: year(e.tmax ?? 22), source: 'climate' as const }]));

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
  it('이번 달이 best에 든 도시만, 인기 먼저·정렬 순서대로', () => {
    const ds = [dest('plain-a', { sort_order: 1 }), dest('pop-b', { is_featured: true, sort_order: 5 }), dest('pop-a', { is_featured: true, sort_order: 2 }), dest('other-month', { is_featured: true, sort_order: 1 })];
    const t = table({ 'plain-a': {}, 'pop-b': {}, 'pop-a': {}, 'other-month': { best: [4] } });
    expect(rankSeasonCandidates(ds, t, 10).map((c) => c.slug)).toEqual(['pop-a', 'pop-b', 'plain-a']);
  });

  it('최대 6곳(기본)', () => {
    const ds = Array.from({ length: 10 }, (_, i) => dest(`c${i}`, { sort_order: i }));
    const t = table(Object.fromEntries(ds.map((d) => [d.slug, {}])));
    expect(rankSeasonCandidates(ds, t, 10)).toHaveLength(6);
    expect(rankSeasonCandidates(ds, t, 10, 3)).toHaveLength(3);
  });

  it('기후 자료가 없거나 그 달 값이 깨진 도시는 건너뛴다', () => {
    const t = table({ ok: {}, broken: {}, nan: {} });
    t.broken.monthly[9] = null;
    t.nan.monthly[9] = [NaN, 1, 1];
    expect(rankSeasonCandidates([dest('ok'), dest('broken'), dest('nan'), dest('no-data')], t, 10).map((c) => c.slug)).toEqual(['ok']);
  });

  it('그 달의 기후와 배지 종류를 담는다', () => {
    const [c] = rankSeasonCandidates([dest('hot')], table({ hot: { tmax: 31 } }), 10);
    expect(c).toMatchObject({ slug: 'hot', kind: 'warm', stat: [31, 23, 60], country: 'JP' });
  });
});

describe('seasonClimate.json — 300개 도시 자료', () => {
  const t = climate as unknown as SeasonClimateTable;

  it('모든 도시에 가기 좋은 달(1~5개, 1~12)과 12달 기후가 있다', () => {
    const slugs = Object.keys(t);
    expect(slugs.length).toBe(300);
    for (const slug of slugs) {
      const c = t[slug];
      expect(c.best.length, slug).toBeGreaterThanOrEqual(1);
      expect(c.best.every((m) => Number.isInteger(m) && m >= 1 && m <= 12), slug).toBe(true);
      expect(c.monthly.length, slug).toBe(12);
      expect(c.monthly.every((s) => s && s.length === 3 && s.every((n) => Number.isFinite(n))), slug).toBe(true);
      expect(['guide', 'climate']).toContain(c.source);
    }
  });

  it('최고기온이 최저기온보다 낮은 달이 없다(자료가 뒤집히지 않았다)', () => {
    for (const [slug, c] of Object.entries(t)) for (const [tmax, tmin] of c.monthly as MonthStat[]) expect(tmax >= tmin, slug).toBe(true);
  });

  it('대표 도시: 방콕은 건기(11~2월)가, 시드니는 남반구 봄·가을이 들어 있다', () => {
    expect(t.bangkok.best).toEqual(expect.arrayContaining([1, 2, 11, 12]));
    expect(t.sydney.best).toEqual(expect.arrayContaining([3, 4, 5, 9, 10, 11]));
    expect(t.sydney.best).not.toContain(7); // 7월은 시드니의 겨울
  });
});
