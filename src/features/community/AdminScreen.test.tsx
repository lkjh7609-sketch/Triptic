import { Suspense } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/shared/i18n';

const state = vi.hoisted(() => ({ user: { id: 'a1' } as { id: string } | null, admin: true }));
vi.mock('@/shared/hooks/useSession', () => ({ useSession: () => ({ user: state.user, loading: false }) }));
vi.mock('@/shared/monitoring', () => ({ trackScreenView: () => {}, captureError: () => {} }));
vi.mock('./communityService', () => ({ isAdmin: async () => state.admin }));
vi.mock('./adminService', async () => ({
  ...(await vi.importActual<typeof import('./adminService')>('./adminService')),
  listOpenReports: async () => [],
  listPendingReviewPosts: async () => [],
  listPendingReviewCompanionPosts: async () => [],
  adminListFeedback: async () => ({ rows: [], total: 0 }),
  adminDashboardStats: async () => ({
    reports_open: 0,
    pending_review: 0,
    suspensions_active: 0,
    feedback_new: 0,
    members_total: 6,
    members_today: 0,
    members_7d: 0,
    trips_total: 0,
    trips_7d: 0,
    signups_14d: [],
    recent_members: [],
    recent_suspensions: [],
  }),
}));
vi.mock('./AdminPinPad', () => ({ AdminPinPad: () => <div>보안코드판</div> }));
vi.mock('./AdminMembersTab', () => ({
  AdminMembersTab: ({ onOpenHistory }: { onOpenHistory?: () => void }) => (
    <div>
      회원 탭 본문
      <button type="button" onClick={onOpenHistory}>
        정지 기록 가기
      </button>
    </div>
  ),
}));
vi.mock('./AdminSuspensionHistory', () => ({ AdminSuspensionHistory: () => <div>정지 기록 본문</div> }));
vi.mock('./AdminNoticesTab', () => ({ AdminNoticesTab: () => <div>공지 본문</div> }));
vi.mock('./AdminSalesTab', () => ({ AdminSalesTab: () => <div>판매 본문</div> }));
vi.mock('./AdminAnalyticsTab', () => ({ AdminAnalyticsTab: () => <div>분석 본문</div> }));
vi.mock('./AdminArchiveTab', () => ({ AdminArchiveTab: () => <div>보관함 본문</div> }));

import { AdminScreen } from './AdminScreen';

function Where() {
  const loc = useLocation();
  return <output aria-label="주소">{loc.pathname + loc.search}</output>;
}

function renderAt(url: string) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]}>
        <Suspense fallback={null}>
          <AdminScreen />
        </Suspense>
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  state.user = { id: 'a1' };
  state.admin = true;
});

describe('AdminScreen — 왼쪽 메뉴 + 주소(?tab=)', () => {
  it('?tab= 이 없으면 대시보드', async () => {
    renderAt('/admin');
    expect(await screen.findByText('처리할 일')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '대시보드' })).toHaveAttribute('aria-current', 'page');
  });

  it('모르는 ?tab= 값도 대시보드', async () => {
    renderAt('/admin?tab=nope');
    expect(await screen.findByText('처리할 일')).toBeInTheDocument();
  });

  it('?tab=members 로 바로 들어가면 회원 화면', async () => {
    renderAt('/admin?tab=members');
    expect(await screen.findByText(/회원 탭 본문/)).toBeInTheDocument();
  });

  it('메뉴를 누르면 화면과 주소가 같이 바뀌고, 대시보드는 ?tab= 이 없다', async () => {
    renderAt('/admin?tab=members');
    await screen.findByText(/회원 탭 본문/);
    const nav = screen.getByRole('navigation');
    fireEvent.click(within(nav).getByRole('button', { name: '공지' }));
    expect(await screen.findByText('공지 본문')).toBeInTheDocument();
    expect(screen.getByLabelText('주소')).toHaveTextContent('/admin?tab=notices');
    fireEvent.click(within(nav).getByRole('button', { name: '대시보드' }));
    expect(await screen.findByText('처리할 일')).toBeInTheDocument();
    expect(screen.getByLabelText('주소')).toHaveTextContent(/^\/admin$/);
  });

  it('회원 화면의 "정지 기록" 링크가 정지 기록 화면으로 보낸다', async () => {
    renderAt('/admin?tab=members');
    fireEvent.click(await screen.findByRole('button', { name: '정지 기록 가기' }));
    expect(await screen.findByText('정지 기록 본문')).toBeInTheDocument();
    expect(screen.getByLabelText('주소')).toHaveTextContent('/admin?tab=suspensions');
  });

  it('로그인하지 않았으면 보안코드판, 일반 사용자면 권한 안내만 — 메뉴는 보이지 않는다', async () => {
    state.user = null;
    const first = renderAt('/admin');
    expect(await screen.findByText('보안코드판')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    first.unmount();

    state.user = { id: 'u1' };
    state.admin = false;
    renderAt('/admin?tab=members');
    expect(await screen.findByText('운영자 권한이 필요한 화면이에요.')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByText(/회원 탭 본문/)).not.toBeInTheDocument();
  });
});
