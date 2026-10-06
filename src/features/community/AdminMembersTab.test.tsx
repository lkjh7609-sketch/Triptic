import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/shared/i18n';

const state = vi.hoisted(() => ({ list: vi.fn(), trips: vi.fn(), remove: vi.fn(), tripView: vi.fn(), suspensions: vi.fn(), lift: vi.fn() }));
vi.mock('@/shared/ui/toast', () => ({ showToast: vi.fn() }));

vi.mock('./adminService', () => ({
  adminListMembers: (...args: unknown[]) => state.list(...args),
  adminMemberTrips: (...args: unknown[]) => state.trips(...args),
  adminRemoveMember: (...args: unknown[]) => state.remove(...args),
  adminGetTrip: (...args: unknown[]) => state.tripView(...args),
  adminListSuspensions: (...args: unknown[]) => state.suspensions(...args),
  adminLiftSuspension: (...args: unknown[]) => state.lift(...args),
  AdminRemoveMemberError: class extends Error {
    constructor(readonly code: string) {
      super(code);
    }
  },
}));
vi.mock('./analyticsService', () => ({ fetchAdminUserActivity: async () => ({ status: 'not_configured' }) }));
vi.mock('./AdminUserPlanRow', () => ({ AdminUserPlanRow: () => <div>등급 줄</div> }));

import { AdminMembersTab } from './AdminMembersTab';

const member = {
  id: 'u1',
  display_name: '여행자',
  handle: 'abc12',
  email: 'traveler@example.com',
  plan: 'free',
  gender: 'female',
  age_band: '20s_late',
  created_at: '2026-09-01T03:00:00Z',
  last_sign_in_at: '2026-10-04T03:00:00Z',
  last_seen_at: '2026-10-05T03:00:00Z',
  last_country: 'KR',
  last_city: null,
  trips_created_count: 2,
  trip_limit: 5,
  avatar_url: null,
  total_count: 1,
};

function renderTab() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AdminMembersTab />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  state.remove.mockReset().mockResolvedValue(undefined);
  state.suspensions.mockReset().mockResolvedValue([]);
  state.lift.mockReset().mockResolvedValue(undefined);
  state.tripView.mockReset().mockResolvedValue({
    trip: { id: 't1', owner_id: 'u1', title: '도쿄 3박 4일', city: 'Tokyo', start_date: '2026-10-15', end_date: '2026-10-18', total_days: 4, base_currency: 'JPY', created_at: '', updated_at: '', deleted_at: null, owner_name: '여행자', owner_handle: 'abc12', member_count: 1 },
    days: [{ id: 'd1', day_index: 1, date: '2026-10-15', city_name: 'Tokyo', note: null }],
    items: [{ id: 'i1', day_id: 'd1', position: 0, type: 'place', title: '시부야 스카이', subtitle: null, category: 'sight', address: '도쿄', start_local: '2026-10-15T10:30:00', end_local: null, memo: '노을 시간에' }],
    hotels: [{ id: 'h1', day: 1, name: '그레이서리 신주쿠', address: null }],
    flights: [],
  });
  state.list.mockReset().mockResolvedValue({ rows: [member], total: 1 });
  state.trips.mockReset().mockResolvedValue([
    { id: 't1', title: '도쿄 3박 4일', city: 'Tokyo', start_date: '2026-10-15', end_date: '2026-10-18', total_days: 4, status: 'planning', created_at: '2026-09-02T00:00:00Z', updated_at: '', deleted_at: null },
  ]);
});

describe('AdminMembersTab', () => {
  it('회원 수·이메일·나잇대/성별을 보여 주고, 눌러 펼치면 위치·만든 여행이 보인다', async () => {
    renderTab();
    expect(await screen.findByText('traveler@example.com')).toBeInTheDocument();
    expect(screen.getByText('회원 1명')).toBeInTheDocument();
    expect(screen.getByText('20대 후반 · 여성')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /여행자/ }));
    expect(screen.getByText('대한민국')).toBeInTheDocument();
    expect(await screen.findByText('도쿄 3박 4일')).toBeInTheDocument();
    expect(screen.getByText('등급 줄')).toBeInTheDocument();
  });

  it('필터를 걸고 검색하면 그 조건으로 다시 조회한다(첫 쪽부터)', async () => {
    renderTab();
    await screen.findByText('traveler@example.com');
    fireEvent.change(screen.getByLabelText('성별'), { target: { value: 'male' } });
    fireEvent.change(screen.getByLabelText('나잇대'), { target: { value: 'none' } });
    fireEvent.change(screen.getByLabelText('이름·핸들·이메일로 검색'), { target: { value: ' kim ' } });
    fireEvent.click(screen.getByRole('button', { name: /검색/ }));
    await waitFor(() =>
      expect(state.list).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'kim', gender: 'male', ageBand: 'none' }), 0, 20),
    );
  });

  it('여행의 "내용 보기"를 누르면 읽기 전용으로 일차별 장소·메모·숙소가 보인다', async () => {
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: /여행자/ }));
    fireEvent.click(await screen.findByRole('button', { name: '내용 보기' }));
    expect(await screen.findByText('읽기 전용')).toBeInTheDocument();
    expect(await screen.findByText('시부야 스카이')).toBeInTheDocument();
    expect(screen.getByText('노을 시간에')).toBeInTheDocument();
    expect(screen.getByText(/그레이서리 신주쿠/)).toBeInTheDocument();
    expect(screen.getByText('10:30')).toBeInTheDocument();
  });

  it('강제 탈퇴는 사유를 골라야 눌러지고, 고른 사유와 함께 서버에 요청한다', async () => {
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: /여행자/ }));
    fireEvent.click(screen.getByRole('button', { name: '강제 탈퇴' }));
    expect(state.remove).not.toHaveBeenCalled();
    // 사유를 고르기 전에는 탈퇴시키기가 막혀 있다
    expect(screen.getByRole('button', { name: '탈퇴시키기' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('정지 사유'), { target: { value: 'spam' } });
    fireEvent.click(screen.getByRole('button', { name: '탈퇴시키기' }));
    await waitFor(() => expect(state.remove).toHaveBeenCalledWith('u1', 'spam'));
  });

  it('이용 정지 계정 목록을 펼쳐 정지를 해제할 수 있다(이미 해제된 줄에는 버튼이 없다)', async () => {
    state.suspensions.mockResolvedValue([
      { id: 7, email: 'bad@example.com', display_name: '나쁜사람', reason: 'fraud', suspended_at: '2026-10-06T12:47:00Z', lifted_at: null },
      { id: 6, email: 'old@example.com', display_name: null, reason: 'abuse', suspended_at: '2026-10-01T12:47:00Z', lifted_at: '2026-10-02T12:47:00Z' },
    ]);
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: /이용 정지 계정 \(1\)/ }));
    expect(await screen.findByText('bad@example.com')).toBeInTheDocument();
    expect(screen.getByText(/사기·허위 정보/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '정지 해제' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: '정지 해제' }));
    expect(state.lift).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '해제하기' }));
    await waitFor(() => expect(state.lift).toHaveBeenCalledWith(7));
  });
});
