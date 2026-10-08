import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@/shared/i18n';
import { TripStatus } from './MyTripsSection';
import type { UpcomingTripView } from './useUpcomingTrip';

function view(over: Partial<UpcomingTripView>): UpcomingTripView {
  return {
    trip: {} as UpcomingTripView['trip'],
    daysUntil: 6,
    nights: 8,
    totalDays: 9,
    completeness: 0,
    placeCount: 0,
    hasHotel: false,
    hasFlight: false,
    members: [],
    ...over,
  };
}

describe('홈 내 일정 카드 — 숙소·항공편 상태 줄', () => {
  it('둘 다 등록: 장소 · 숙소 · 항공편이 체크와 함께 나오고 "미정"은 없다', () => {
    render(<p><TripStatus view={view({ placeCount: 3, hasHotel: true, hasFlight: true })} /></p>);
    expect(screen.getByText('장소 3곳')).toBeInTheDocument();
    expect(screen.getByLabelText('숙소 등록됨')).toBeInTheDocument();
    expect(screen.getByLabelText('항공편 등록됨')).toBeInTheDocument();
    expect(screen.queryByText(/미정/)).toBeNull();
  });

  it('숙소만 등록: 항공편은 "항공편 미정"', () => {
    render(<p><TripStatus view={view({ placeCount: 3, hasHotel: true })} /></p>);
    expect(screen.getByLabelText('숙소 등록됨')).toBeInTheDocument();
    expect(screen.getByText('항공편 미정')).toBeInTheDocument();
    expect(screen.queryByText('숙소 미정')).toBeNull();
  });

  it('둘 다 아직: 장소가 없으면 장소는 빼고 두 개 모두 미정', () => {
    render(<p><TripStatus view={view({})} /></p>);
    expect(screen.getByText('숙소 미정')).toBeInTheDocument();
    expect(screen.getByText('항공편 미정')).toBeInTheDocument();
    expect(screen.queryByText(/장소/)).toBeNull();
  });
});
