import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/shared/i18n';

const state = vi.hoisted(() => ({ list: vi.fn(), trips: vi.fn() }));

vi.mock('./adminService', () => ({
  adminListMembers: (...args: unknown[]) => state.list(...args),
  adminMemberTrips: (...args: unknown[]) => state.trips(...args),
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
});
