import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { BookingRow } from './documentService';
import type { ParsedFlight } from './parseBooking/schema';
import type { FlightsData } from '../plan/types';

vi.mock('./useDocuments', () => ({
  useConfirmBooking: () => ({ mutateAsync: vi.fn(async () => undefined) }),
  useRejectBooking: () => ({ mutateAsync: vi.fn(async () => undefined) }),
}));

const { ReviewSheet } = await import('./ReviewSheet');

const f = <T,>(value: T | null) => ({ value, confidence: 0.9 });
function leg(fn: string, dep: string, depAt: string, arr: string, arrAt: string): ParsedFlight {
  return {
    kind: 'flight',
    carrierIata: f(fn.slice(0, 2)),
    carrierName: f('Air Seoul'),
    flightNumber: f(fn),
    departure: { airportIata: f(dep), airportName: f(dep), terminal: f(null), scheduledLocal: f(depAt), airportLat: 1, airportLng: 2 },
    arrival: { airportIata: f(arr), airportName: f(arr), terminal: f(null), scheduledLocal: f(arrAt), airportLat: 3, airportLng: 4 },
    bookingReference: f('ABC123'),
    seat: f(null),
    cabinClass: f(null),
  };
}
const row = (id: string, parsed: ParsedFlight): BookingRow => ({
  id,
  trip_id: 't1',
  document_id: 'doc1',
  type: 'flight',
  reference_code: null,
  parsed,
  confirmed_by_user: false,
  parser_version: 'llm/deepseek-flash',
  created_at: '2026-09-28T15:48:47Z',
});

describe('ReviewSheet', () => {
  const roundTrip = () => [
    row('b1', leg('RS717', 'ICN', '2026-07-17T19:05', 'KIX', '2026-07-17T20:50')),
    row('b2', leg('RS714', 'KIX', '2026-07-20T16:15', 'ICN', '2026-07-20T18:25')),
  ];

  it('같은 문서의 왕복 항공편을 연달아 반영하면 출국·귀국으로 나뉜다(화면 데이터가 늦게 갱신돼도)', async () => {
    const saved: FlightsData[] = [];
    const onCommitFlight = vi.fn(async (next: FlightsData) => {
      saved.push(next);
    });
    // 7월 한 달 여행 — 예전 "시작일·종료일 중 가까운 쪽" 판정으론 7/17·7/20 둘 다 귀국 쪽으로 가 덮어썼다
    render(
      <ReviewSheet
        tripId="t1"
        bookings={roundTrip()}
        tripStartDate="2026-07-01"
        tripEndDate="2026-07-31"
        flightsData={{ outbound: null, return: null }}
        onClose={() => {}}
        onCommitFlight={onCommitFlight}
      />,
    );
    const buttons = screen.getAllByRole('button', { name: '일정에 반영' });
    fireEvent.click(buttons[0]);
    await waitFor(() => expect(onCommitFlight).toHaveBeenCalledTimes(1));
    fireEvent.click(buttons[1]);
    await waitFor(() => expect(onCommitFlight).toHaveBeenCalledTimes(2));
    expect(saved[1].outbound?.flightNo).toBe('RS717');
    expect(saved[1].return?.flightNo).toBe('RS714');
  });

  it('항공권 날짜가 여행 기간과 다르면 경고 — 항공권 기간으로 변경 / 지금 기간 유지(기간 밖 항공편은 반영 막음)', async () => {
    const onChangeTripDates = vi.fn(async () => {});
    render(
      <ReviewSheet
        tripId="t1"
        bookings={roundTrip()}
        tripStartDate="2026-10-07"
        tripEndDate="2026-10-14"
        flightsData={{ outbound: null, return: null }}
        onClose={() => {}}
        onCommitFlight={async () => {}}
        onChangeTripDates={onChangeTripDates}
      />,
    );
    expect(screen.getByText('여행 기간과 날짜가 달라요')).toBeInTheDocument();
    for (const b of screen.getAllByRole('button', { name: '일정에 반영' })) expect(b).toBeDisabled();
    expect(screen.getAllByText('여행 기간 밖이라 일정에 넣을 수 없어요')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: '항공권 기간으로 변경' }));
    await waitFor(() => expect(onChangeTripDates).toHaveBeenCalledWith({ start: '2026-07-17', end: '2026-07-20' }));

    fireEvent.click(screen.getByRole('button', { name: '지금 여행 기간 유지' }));
    expect(screen.queryByText('여행 기간과 날짜가 달라요')).not.toBeInTheDocument();
  });

  it('검수할 예약이 없으면 불러오는 중일 때만 안내, 아니면 아무것도 그리지 않는다(부모가 닫음)', () => {
    const props = { tripId: 't1', bookings: [], tripStartDate: '2026-10-07', tripEndDate: '2026-10-14', flightsData: { outbound: null, return: null }, onClose: () => {}, onCommitFlight: async () => {} };
    const { container, rerender } = render(<ReviewSheet {...props} loading />);
    expect(screen.getByText('예약을 불러오는 중…')).toBeInTheDocument();
    rerender(<ReviewSheet {...props} loading={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});
