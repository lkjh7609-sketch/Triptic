import { cityDisplayName } from '@/features/plan/cityName';

export interface MatchPost {
  destinationName?: string | null;
  /** 날짜 미정(협의) 글은 둘 다 null — 도시만 비교한다 */
  startDate: string | null;
  endDate: string | null;
  /** 글이 원하는 나이대(비어 있으면 무관)·성별('any'면 무관) */
  prefAges?: string[] | null;
  prefGender?: 'any' | 'female' | 'male' | null;
}

/** 내 나이대·성별 — 프로필에 없으면 null */
export interface MatchMe {
  ageBand: string | null;
  gender: 'female' | 'male' | null;
}

export interface MatchTrip {
  city: string | null;
  startDate: string | null;
  endDate: string | null;
}

const DAY = 86_400_000;

function utc(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function sameCity(a: string, b: string): boolean {
  const x = cityDisplayName(a).toLowerCase();
  const y = cityDisplayName(b).toLowerCase();
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
}

/** 점수 배분 — 도시 30 · 날짜 30 · 나이대 20 · 성별 20. 나이대·성별 칸은 글이 조건을 걸었고 내 프로필에 값이 있을 때만 계산에 넣는다 */
const W_CITY = 30;
const W_DATE = 30;
const W_AGE = 20;
const W_GENDER = 20;

export interface DemographicFit {
  /** 글이 건 조건 중 내 프로필로 확인할 수 있는 것이 모두 맞으면 어떤 조건이었는지(둘 다/나이대만/성별만), 아니면 null */
  matched: 'both' | 'age' | 'gender' | null;
  /** 확인할 수 있는 조건 중 하나라도 안 맞는다 */
  mismatch: boolean;
  ageFit: boolean | null;
  genderFit: boolean | null;
}

/** 글이 원하는 나이대·성별과 내 나이대·성별이 맞는지. 글이 조건을 안 걸었거나 내 값이 없으면 그 칸은 판단하지 않는다(null) */
export function demographicFit(post: MatchPost, me: MatchMe | null | undefined): DemographicFit {
  const ages = post.prefAges ?? [];
  const ageFit = me?.ageBand && ages.length > 0 ? ages.includes(me.ageBand) : null;
  const gender = post.prefGender && post.prefGender !== 'any' ? post.prefGender : null;
  const genderFit = me?.gender && gender ? me.gender === gender : null;
  const mismatch = ageFit === false || genderFit === false;
  const matched =
    mismatch || (ageFit === null && genderFit === null) ? null : ageFit !== null && genderFit !== null ? 'both' : ageFit !== null ? 'age' : 'gender';
  return { matched, mismatch, ageFit, genderFit };
}

/**
 * 동행 글과 나의 "일치율"(0~100).
 * - 내 다음 여행이 있으면: 도시가 같으면 30점, 날짜가 겹치는 정도(겹친 날÷더 긴 쪽 일수)에 최대 30점.
 * - 나이대·성별: 글이 조건을 걸었고 내 프로필에 값이 있으면 맞을 때 각 20점. 조건이 없거나 내 값이 없으면 그 칸은 점수 계산에 넣지 않는다.
 * 얻은 점수 ÷ 계산에 들어간 만점 × 100. 맞는 게 하나도 없으면 null(0%를 보여주지 않고 배지를 숨긴다).
 * 내 여행이 없으면 퍼센트는 계산하지 않는다(null) — 그때는 demographicFit으로 '나이대·성별 일치'만 보여 준다.
 */
export function matchScore(post: MatchPost, trip: MatchTrip, me?: MatchMe | null): number | null {
  const cityScore = post.destinationName && trip.city && sameCity(post.destinationName, trip.city) ? W_CITY : 0;

  let dateScore = 0;
  if (trip.startDate && post.startDate && post.endDate) {
    const tripStart = utc(trip.startDate);
    const tripEnd = utc(trip.endDate ?? trip.startDate);
    const postStart = utc(post.startDate);
    const postEnd = utc(post.endDate);
    const overlap = Math.min(tripEnd, postEnd) - Math.max(tripStart, postStart);
    if (overlap >= 0) {
      const overlapDays = overlap / DAY + 1;
      const longer = Math.max((tripEnd - tripStart) / DAY + 1, (postEnd - postStart) / DAY + 1);
      dateScore = (overlapDays / longer) * W_DATE;
    }
  }

  const fit = demographicFit(post, me);
  let earned = cityScore + dateScore;
  let possible = W_CITY + W_DATE;
  if (fit.ageFit !== null) {
    possible += W_AGE;
    if (fit.ageFit) earned += W_AGE;
  }
  if (fit.genderFit !== null) {
    possible += W_GENDER;
    if (fit.genderFit) earned += W_GENDER;
  }

  const pct = Math.round((earned / possible) * 100);
  return pct > 0 ? Math.min(100, pct) : null;
}
