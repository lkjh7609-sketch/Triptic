import { Suspense } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/shared/i18n';

const state = vi.hoisted(() => ({ stats: vi.fn() }));
vi.mock('./adminService', async () => ({
  ...(await vi.importActual<typeof import('./adminService')>('./adminService')),
  adminDashboardStats: () => state.stats(),
}));

import { AdminDashboard } from './AdminDashboard';

const days = Array.from({ length: 14 }, (_, i) => ({ day: `2026-10-${String(i + 1).padStart(2, '0')}`, count: i === 13 ? 3 : 0 }));
const base = {
  reports_open: 2,
  pending_review: 0,
  suspensions_active: 1,
  feedback_new: 4,
  members_total: 6,
  members_today: 1,
  members_7d: 3,
  trips_total: 9,
  trips_7d: 2,
  signups_14d: days,
  recent_members: [{ id: 'u1', display_name: '곽현재', handle: 'qd6u5', created_at: '2026-10-09T01:00:00Z' }],
  recent_suspensions: [{ id: 1, email: 'bad@example.com', reason: 'fraud', suspended_at: '2026-10-06T12:00:00Z', lifted_at: null }],
};

function renderDash(onNavigate = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Suspense fallback={null}>
        <AdminDashboard onNavigate={onNavigate} />
      </Suspense>
    </QueryClientProvider>,
  );
  return onNavigate;
}

beforeEach(() => {
  state.stats.mockReset().mockResolvedValue(base);
});

describe('AdminDashboard', () => {
  it('처리할 일(신고·검수 대기·건의·정지 중)과 현황 숫자를 보여 준다', async () => {
    renderDash();
    expect(await screen.findByText('처리할 일')).toBeInTheDocument();
    expect(screen.getByText('6건')).toBeInTheDocument(); // 처리할 일 합계 = 신고 2 + 검수 0 + 건의 4
    expect(screen.getByRole('button', { name: /신고 큐/ })).toHaveTextContent('2건');
    expect(screen.getByRole('button', { name: /건의함/ })).toHaveTextContent('4건');
    expect(screen.getByRole('button', { name: /이용 정지 중/ })).toHaveTextContent('1명');
    expect(screen.getByText('전체 회원').nextElementSibling).toHaveTextContent('6명');
    expect(screen.getByText('최근 7일 새 여행').nextElementSibling).toHaveTextContent('2건');
  });

  it('칸을 누르면 그 메뉴로 간다', async () => {
    const onNavigate = renderDash();
    fireEvent.click(await screen.findByRole('button', { name: /신고 큐/ }));
    fireEvent.click(screen.getByRole('button', { name: /건의함/ }));
    fireEvent.click(screen.getByRole('button', { name: /이용 정지 중/ }));
    fireEvent.click(screen.getByRole('button', { name: /전체 회원/ }));
    expect(onNavigate.mock.calls.map((c) => c[0])).toEqual(['reports', 'feedback', 'suspensions', 'members']);
  });

  it('처리할 일이 없으면 모두 처리했다고 알린다', async () => {
    state.stats.mockResolvedValue({ ...base, reports_open: 0, pending_review: 0, feedback_new: 0 });
    renderDash();
    expect(await screen.findByText('모두 처리했어요')).toBeInTheDocument();
  });

  it('최근 가입자·최근 정지 기록과 14일 가입 그래프가 나온다', async () => {
    renderDash();
    expect(await screen.findByText('곽현재')).toBeInTheDocument();
    expect(screen.getByText('bad@example.com')).toBeInTheDocument();
    expect(screen.getByText('정지 중')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(14);
  });

  it('불러오지 못하면 안내와 다시 시도 버튼', async () => {
    state.stats.mockRejectedValue(new Error('boom'));
    renderDash();
    expect(await screen.findByText('대시보드를 불러오지 못했어요.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /다시/ })).toBeInTheDocument();
  });
});
