/**
 * "지금 가기 좋은 여행지" — 도시마다 '가기 좋은 달'과 월별 기후(seasonClimate.json)로 이번 달 추천 도시를 고른다.
 * seasonClimate.json은 NASA POWER 기후 평년값(2001~2020년 20년 평균)에서 계산해 만든 정적 파일이다(바뀔 일이 없는 자료라 DB가 아니라 앱에 포함).
 *  - 월별 기후 monthly = [[평균 최고℃, 평균 최저℃, 월 강수량 mm] × 1~12월]. 평균 최고·최저는 평균기온 ± 일교차/2.
 *  - 가기 좋은 달 best: 도시 채널 안내(destination_guides.best_season)에 추천 달이 있으면 그 달(source=guide, 100곳), 없으면 '쾌적함 점수'
 *    (최고기온 19~28℃ 밖 감점, 밤 기온 5℃ 미만·26℃ 초과 감점, 월 강수량 1mm당 0.09점 감점) 상위 달(최고점에서 10점 이내·55점 이상, 최대 5개,
 *    source=climate, 200곳). 벚꽃·단풍·행사 같은 이유는 반영하지 못한다.
 */

/** 한 달의 기후 — [평균 최고기온℃, 평균 최저기온℃, 월 강수량(mm)] */
export type MonthStat = [number, number, number];

/** 배지 종류 — 그 달의 평균 최고기온으로 */
export type SeasonKind = 'warm' | 'pleasant' | 'cool';

export function seasonKind(stat: MonthStat): SeasonKind {
  const tmax = stat[0];
  if (tmax >= 27) return 'warm';
  if (tmax >= 17) return 'pleasant';
  return 'cool';
}

/** seasonClimate.json 한 도시 */
export interface SeasonClimate {
  best: number[];
  monthly: Array<MonthStat | null>;
  source: 'guide' | 'climate';
}
export type SeasonClimateTable = Record<string, SeasonClimate>;

/** 추천에 필요한 도시 정보(community의 Destination이 그대로 맞는다) */
export interface SeasonDestination {
  id: string;
  slug: string;
  country_code: string;
  lat: number;
  lng: number;
  cover_url: string | null;
  is_featured: boolean;
  sort_order: number;
}

/** 이번 달 추천 후보 — 이름·날씨는 화면 쪽에서 채운다 */
export interface SeasonCandidate {
  id: string;
  slug: string;
  country: string;
  lat: number;
  lng: number;
  cover: string | null;
  featured: boolean;
  stat: MonthStat;
  kind: SeasonKind;
}

const validStat = (s: unknown): s is MonthStat => Array.isArray(s) && s.length === 3 && s.every((n) => typeof n === 'number' && Number.isFinite(n));

export const SEASON_PICK_COUNT = 6;

/**
 * 이번 달(1~12)이 '가기 좋은 달'인 도시 중 인기(is_featured)를 먼저, 같은 무리 안에서는 도시 정렬 순서대로 limit곳.
 * 기후 자료가 없거나 그 달 값이 깨진 도시는 건너뛴다(화면에 빈 숫자를 만들지 않는다).
 */
export function rankSeasonCandidates(destinations: SeasonDestination[], table: SeasonClimateTable, month: number, limit = SEASON_PICK_COUNT): SeasonCandidate[] {
  return destinations
    .filter((d) => {
      const c = table[d.slug];
      return !!c && c.best.includes(month) && validStat(c.monthly[month - 1]);
    })
    .sort((a, b) => Number(b.is_featured) - Number(a.is_featured) || a.sort_order - b.sort_order)
    .slice(0, limit)
    .map((d) => {
      const stat = table[d.slug].monthly[month - 1] as MonthStat;
      return { id: d.id, slug: d.slug, country: d.country_code, lat: d.lat, lng: d.lng, cover: d.cover_url, featured: d.is_featured, stat, kind: seasonKind(stat) };
    });
}
