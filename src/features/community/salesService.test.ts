import { describe, expect, it } from 'vitest';
import { salesRange, summarizeSales, type SalesReservation, type SalesRevenue } from './salesService';

function reservation(overrides: Partial<SalesReservation>): SalesReservation {
  return {
    kind: 'tna',
    reservationNo: 'R',
    linkId: null,
    title: null,
    category: null,
    status: 'CONFIRM',
    statusLabel: null,
    amount: 0,
    quantity: 1,
    city: null,
    reservedAt: null,
    canceledAt: null,
    placement: null,
    ...overrides,
  };
}

function revenue(commission: number): SalesRevenue {
  return { kind: 'tna', reservationNo: 'R', linkId: null, title: null, closingType: null, amount: null, commission, commissionRate: null, date: null, reservedAt: null, placement: null };
}

describe('summarizeSales', () => {
  it('취소(투어 CANCEL·항공 CANCELLED·취소 시각)는 판매액에서 빼고 따로 센다, 수익은 환불 음수까지 합', () => {
    const summary = summarizeSales({
      reservations: [
        reservation({ amount: 150000 }),
        reservation({ kind: 'flight', status: 'CONFIRMED', amount: 450000 }),
        reservation({ status: 'CANCEL', amount: 89000 }),
        reservation({ kind: 'flight', status: 'CANCELLED', amount: 305490 }),
        reservation({ status: 'CONFIRM', canceledAt: '2026-09-01T00:00:00', amount: 1000 }),
        reservation({ amount: null }),
      ],
      revenues: [revenue(14700), revenue(-14700), revenue(4500)],
    });
    expect(summary).toEqual({ bookings: 3, cancelled: 3, salesAmount: 600000, commission: 4500 });
  });

  it('내역이 없으면 0', () => {
    expect(summarizeSales({})).toEqual({ bookings: 0, cancelled: 0, salesAmount: 0, commission: 0 });
  });
});

describe('salesRange', () => {
  it('오늘 포함 최근 N일', () => {
    expect(salesRange(7, new Date(2026, 8, 28))).toEqual({ from: '2026-09-22', to: '2026-09-28' });
    expect(salesRange(180, new Date(2026, 8, 28))).toEqual({ from: '2026-04-02', to: '2026-09-28' });
  });
});
