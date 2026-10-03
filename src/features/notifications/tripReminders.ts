import type { TripRow } from '@/shared/api/tripService';

/** 출발까지의 단계 — 7일 전 / 하루 전 / 당일. 앱을 연 날을 기준으로 가장 가까운 단계 하나만 보인다 */
export type ReminderStage = 'week' | 'dayBefore' | 'today';

export interface TripReminder {
  /** `여행id:단계` — 읽음·지우기 기록의 키 */
  id: string;
  tripId: string;
  title: string;
  city: string | null;
  stage: ReminderStage;
  /** 출발까지 남은 일수(0=오늘) */
  daysUntil: number;
}

const WEEK_DAYS = 7;

function ymdToUtc(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function daysBetween(todayYmd: string, startYmd: string): number {
  return Math.round((ymdToUtc(startYmd) - ymdToUtc(todayYmd)) / 86400000);
}

/** 출발까지 남은 일수 → 알림 단계(해당 없으면 null). 2~7일 전은 모두 '일주일 전' 알림 하나로 이어진다 — 정확히 7일 전 날 앱을 안 열어도 놓치지 않게 */
export function stageFor(daysUntil: number): ReminderStage | null {
  if (daysUntil === 0) return 'today';
  if (daysUntil === 1) return 'dayBefore';
  if (daysUntil >= 2 && daysUntil <= WEEK_DAYS) return 'week';
  return null;
}

/** 내 여행 중 곧 떠나는 것들의 알림 — 가까운 출발 순. 날짜가 없는 여행·보관한 여행·이미 출발한 여행은 뺀다 */
export function buildTripReminders(trips: TripRow[], todayYmd: string): TripReminder[] {
  const out: TripReminder[] = [];
  for (const trip of trips) {
    if (trip.status === 'archived' || !trip.start_date) continue;
    const daysUntil = daysBetween(todayYmd, trip.start_date);
    const stage = stageFor(daysUntil);
    if (!stage) continue;
    out.push({
      id: `${trip.id}:${stage}`,
      tripId: trip.id,
      title: trip.title,
      city: trip.city,
      stage,
      daysUntil,
    });
  }
  return out.sort((a, b) => a.daysUntil - b.daysUntil || a.title.localeCompare(b.title));
}
