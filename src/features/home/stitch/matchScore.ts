import { cityDisplayName } from '@/features/plan/cityName';

export interface MatchPost {
  destinationName?: string | null;
  /** 날짜 미정(협의) 글은 둘 다 null — 도시만 비교한다 */
  startDate: string | null;
  endDate: string | null;
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

/**
 * 동행 글과 내 다음 여행의 "일치율"(0~100) — 도시가 같으면 50점, 날짜가 겹치는 정도(겹친 날÷더 긴 쪽 일수)에 최대 50점.
 * 도시나 날짜 중 맞는 게 하나도 없으면 null(0%를 보여주지 않고 배지를 숨긴다). 내 여행이 없으면 계산할 수 없어 호출하지 않는다.
 */
export function matchScore(post: MatchPost, trip: MatchTrip): number | null {
  const cityScore = post.destinationName && trip.city && sameCity(post.destinationName, trip.city) ? 50 : 0;

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
      dateScore = Math.round((overlapDays / longer) * 50);
    }
  }

  const total = cityScore + dateScore;
  return total > 0 ? Math.min(100, total) : null;
}
