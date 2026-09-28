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
  it('같은 문서의 왕복 항공편을 연달아 반영하면 출국·귀국으로 나뉜다(화면 데이터가 늦게 갱신돼도)', async () => {
    const saved: FlightsData[] = [];
    const onCommitFlight = vi.fn(async (next: FlightsData) => {
      saved.push(next);
    });
    // 여행(10/7~10/14)과 날짜가 다른 7월 오사카 왕복 — 예전엔 둘 다 출국 칸으로 들어가 덮어썼다
    const bookings = [
      row('b1', leg('RS717', 'ICN', '2026-07-17T19:05', 'KIX', '2026-07-17T20:50')),
      row('b2', leg('RS714', 'KIX', '2026-07-20T16:15', 'ICN', '2026-07-20T18:25')),
    ];
    render(
      <ReviewSheet
        tripId="t1"
        bookings={bookings}
        tripStartDate="2026-10-07"
        tripEndDate="2026-10-14"
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
});
