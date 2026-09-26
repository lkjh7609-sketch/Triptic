import type { TripRow } from '@/shared/api/tripService';
import { tripService } from '@/shared/api/tripService';
import type { FlightInfo, FlightsData, HotelsData, PlannerData } from './types';

export interface TripSummary {
  totalDays: number;
  /** 장소가 하나 이상 들어간 날 수 */
  plannedDays: number;
  placeCount: number;
  /** 0~100 — 장소가 채워진 날의 비율 */
  completeness: number;
  hasHotel: boolean;
  hasFlight: boolean;
  outbound: FlightInfo | null;
}

/** 여행 카드/대시보드용 요약. 목데이터 없이 여행 스냅샷(TripRow.content)만으로 계산한다. */
export function summarizeTrip(trip: TripRow): TripSummary {
  const project = tripService.toLocalProject(trip);
  const totalDays = Math.max(1, Number(project.totalDays ?? trip.total_days ?? 1) || 1);
  const planner = (project.data ?? {}) as PlannerData;
  const hotels = (project.hotels ?? {}) as HotelsData;
  const flights = (project.flights ?? { outbound: null, return: null }) as FlightsData;

  let plannedDays = 0;
  let placeCount = 0;
  for (let day = 1; day <= totalDays; day++) {
    const items = planner[day] ?? [];
    if (items.length > 0) plannedDays += 1;
    placeCount += items.length;
  }

  return {
    totalDays,
    plannedDays,
    placeCount,
    completeness: Math.round((plannedDays / totalDays) * 100),
    hasHotel: Object.values(hotels).some((h) => !!h?.name),
    hasFlight: !!(flights.outbound || flights.return),
    outbound: flights.outbound ?? null,
  };
}
