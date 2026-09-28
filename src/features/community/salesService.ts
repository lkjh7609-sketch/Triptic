/**
 * 관리자 판매 탭 — 제휴사별 예약 내역·수익 현황(api/adminSales.js).
 * 서버가 토큰으로 관리자인지 직접 확인하므로 로그인 토큰을 Authorization에 실어 보낸다.
 */
import { addDays, format } from 'date-fns';
import { apiUrl } from '@/shared/api/apiUrl';
import { getSupabaseClient } from '@/shared/api/supabaseClient';

export interface SalesReservation {
  kind: 'tna' | 'flight';
  reservationNo: string | null;
  linkId: string | null;
  title: string | null;
  category: string | null;
  status: string | null;
  statusLabel: string | null;
  amount: number | null;
  quantity: number | null;
  city: string | null;
  reservedAt: string | null;
  canceledAt: string | null;
  /** 어디서 누른 링크였는지(partner_links.sub_id) — 모르면 null */
  placement: string | null;
}

export interface SalesRevenue {
  kind: 'tna' | 'flight';
  reservationNo: string | null;
  linkId: string | null;
  title: string | null;
  closingType: string | null;
  amount: number | null;
  /** 환불·차감은 음수 */
  commission: number;
  commissionRate: number | null;
  date: string | null;
  reservedAt: string | null;
  placement: string | null;
}

export interface SalesProvider {
  id: string;
  name: string;
  dashboardUrl: string | null;
  /** ok: 연동됨 · not_configured: 키 없음 · not_integrated: 판매 API 연동 전 · error: 불러오기 실패 */
  status: 'ok' | 'not_configured' | 'not_integrated' | 'error';
  failed?: string[];
  reservations?: SalesReservation[];
  revenues?: SalesRevenue[];
}

export interface SalesReport {
  from: string;
  to: string;
  providers: SalesProvider[];
}

export const SALES_RANGES = [7, 30, 90, 180] as const;
export type SalesRange = (typeof SALES_RANGES)[number];

/** 오늘까지 최근 N일(양끝 포함) */
export function salesRange(days: SalesRange, today: Date = new Date()): { from: string; to: string } {
  return { from: format(addDays(today, -(days - 1)), 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') };
}

export async function fetchAdminSales(from: string, to: string): Promise<SalesReport> {
  const { data } = await getSupabaseClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('adminSales: not signed in');
  const params = new URLSearchParams({ from, to });
  const res = await fetch(apiUrl(`/api/adminSales?${params.toString()}`), { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`adminSales HTTP ${res.status}`);
  return (await res.json()) as SalesReport;
}

const CANCELLED = new Set(['CANCEL', 'CANCELLED', 'FAIL', 'REQUEST_CANCEL']);

export function isCancelled(r: SalesReservation): boolean {
  return (r.status != null && CANCELLED.has(r.status)) || r.canceledAt != null;
}

export interface SalesSummary {
  bookings: number;
  cancelled: number;
  /** 취소되지 않은 예약의 결제 금액 합 */
  salesAmount: number;
  /** 수익 합(환불 차감 포함) */
  commission: number;
}

export function summarizeSales(provider: Pick<SalesProvider, 'reservations' | 'revenues'>): SalesSummary {
  const reservations = provider.reservations ?? [];
  const live = reservations.filter((r) => !isCancelled(r));
  return {
    bookings: live.length,
    cancelled: reservations.length - live.length,
    salesAmount: live.reduce((sum, r) => sum + (r.amount ?? 0), 0),
    commission: (provider.revenues ?? []).reduce((sum, r) => sum + r.commission, 0),
  };
}
