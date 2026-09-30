import { describe, expect, it } from 'vitest';
import { MONTH_PICKS, SEASON_ENTRIES, seasonPicksFor } from './seasonData';

describe('월별 큐레이션 표', () => {
  it('12개월 모두 6도시가 있고, 각 도시에 그 달에 맞는 항목이 있다', () => {
    for (let month = 1; month <= 12; month++) {
      expect(MONTH_PICKS[month], `${month}월`).toHaveLength(6);
      expect(seasonPicksFor(month), `${month}월 항목`).toHaveLength(6);
    }
  });

  it('한 달에 같은 도시가 두 번 나오지 않는다', () => {
    for (let month = 1; month <= 12; month++) {
      expect(new Set(MONTH_PICKS[month]).size).toBe(6);
    }
  });

  it('항목의 달은 1~12이고 한 도시 안에서 항목 id가 겹치지 않는다', () => {
    for (const entries of Object.values(SEASON_ENTRIES)) {
      expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
      for (const e of entries) for (const m of e.months) expect(m >= 1 && m <= 12).toBe(true);
    }
  });
});
