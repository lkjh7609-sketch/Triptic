/**
 * "지금 가기 좋은 여행지" — 도시마다 DB(destination_seasons)에 저장된 '가기 좋은 달'과 월별 기후로 이번 달 추천 도시를 고른다.
 * 가기 좋은 달은 과거 10년의 월별 기온·비 자료로 계산해 마이그레이션(0102)에 넣어 둔 값이다(제안서의 손으로 쓴 표가 아님).
 */

/** 한 달의 기후 — [평균 최고기온℃, 평균 최저기온℃, 월 강수량(mm), 비 오는 날 수] */
export type MonthStat = [number, number, number, number];

/** 배지 종류 — 그 달의 평균 최고기온으로 */
export type SeasonKind = 'warm' | 'pleasant' | 'cool';

export function seasonKind(stat: MonthStat): SeasonKind {
  const tmax = stat[0];
  if (tmax >= 27) return 'warm';
  if (tmax >= 17) return 'pleasant';
  return 'cool';
}

export interface SeasonRow {
  best_months: number[];
  monthly: Array<MonthStat | null>;
  destination: {
    id: string;
    slug: string;
    country_code: string;
    lat: number;
    lng: number;
    cover_url: string | null;
    is_featured: boolean;
    sort_order: number;
  };
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

const validStat = (s: unknown): s is MonthStat => Array.isArray(s) && s.length === 4 && s.every((n) => typeof n === 'number' && Number.isFinite(n));

export const SEASON_PICK_COUNT = 6;

/**
 * 이번 달(1~12)이 '가기 좋은 달'인 도시 중 인기(is_featured)를 먼저, 같은 무리 안에서는 도시 정렬 순서대로 limit곳.
 * 그 달 기후 값이 없거나 깨진 도시는 건너뛴다(화면에 빈 숫자를 만들지 않는다).
 */
export function rankSeasonCandidates(rows: SeasonRow[], month: number, limit = SEASON_PICK_COUNT): SeasonCandidate[] {
  return rows
    .filter((r) => r.best_months.includes(month) && validStat(r.monthly[month - 1]))
    .sort((a, b) => Number(b.destination.is_featured) - Number(a.destination.is_featured) || a.destination.sort_order - b.destination.sort_order)
    .slice(0, limit)
    .map((r) => {
      const stat = r.monthly[month - 1] as MonthStat;
      return {
        id: r.destination.id,
        slug: r.destination.slug,
        country: r.destination.country_code,
        lat: r.destination.lat,
        lng: r.destination.lng,
        cover: r.destination.cover_url,
        featured: r.destination.is_featured,
        stat,
        kind: seasonKind(stat),
      };
    });
}
