import { useMemo } from 'react';
import { format } from 'date-fns';
import { useTrips, useTripSummaries } from '@/features/plan/hooks/useTrips';
import { useTripMembers } from '@/features/plan/hooks/useTripMembers';
import type { TripMember } from '@/features/plan/hooks/useTripMembers';
import type { TripRow } from '@/shared/api/tripService';

export interface UpcomingTripView {
  trip: TripRow;
  /** 오늘 기준 출발까지 남은 일수(0=오늘, 음수=이미 출발해 여행 중) */
  daysUntil: number;
  nights: number;
  totalDays: number;
  /** 0~100 — 장소가 채워진 날의 비율 */
  completeness: number;
  placeCount: number;
  hasHotel: boolean;
  hasFlight: boolean;
  members: TripMember[];
}

function ymdToUtc(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** 가장 가까운(진행 중이거나 곧 떠나는) 내 여행 하나 — 홈 "내 일정" 카드용. 날짜가 없는 여행·보관된 여행은 뺀다 */
export function pickUpcomingTrip(trips: TripRow[], today = format(new Date(), 'yyyy-MM-dd')): TripRow | undefined {
  return trips
    .filter((t) => t.status !== 'archived' && t.start_date && (t.end_date ?? t.start_date) >= today)
    .sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''))[0];
}

export function useUpcomingTrip(signedIn: boolean): { view: UpcomingTripView | null; loading: boolean } {
  const { data: trips, isLoading } = useTrips();
  const { data: summaries } = useTripSummaries(signedIn);
  const trip = useMemo(() => (signedIn ? pickUpcomingTrip(trips ?? []) : undefined), [signedIn, trips]);
  const { data: membersByTrip } = useTripMembers(trip ? [trip.id] : []);

  const view = useMemo<UpcomingTripView | null>(() => {
    if (!trip || !trip.start_date) return null;
    const today = format(new Date(), 'yyyy-MM-dd');
    const daysUntil = Math.round((ymdToUtc(trip.start_date) - ymdToUtc(today)) / 86400000);
    const end = trip.end_date ?? trip.start_date;
    const totalDays = Math.max(1, trip.total_days ?? Math.round((ymdToUtc(end) - ymdToUtc(trip.start_date)) / 86400000) + 1);
    const s = summaries?.[trip.id];
    return {
      trip,
      daysUntil,
      nights: Math.max(0, totalDays - 1),
      totalDays,
      completeness: s ? Math.min(100, Math.round((s.plannedDays / totalDays) * 100)) : 0,
      placeCount: s?.placeCount ?? 0,
      hasHotel: s?.hasHotel ?? false,
      hasFlight: s?.hasFlight ?? false,
      members: membersByTrip?.[trip.id] ?? [],
    };
  }, [trip, summaries, membersByTrip]);

  return { view, loading: signedIn && isLoading };
}
