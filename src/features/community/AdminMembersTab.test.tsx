import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
    constructor(
      readonly code: string,
      readonly detail: { attemptsLeft?: number; retryAfter?: number } = {},
    ) {
      super(code);
    }
  },
}));
// 보안코드를 쓸 수 있는 상태(켜짐·안 잠김)가 기본
const pin = vi.hoisted(() => ({ status: vi.fn() }));
vi.mock('./adminPinService', async () => ({ ...(await vi.importActual<typeof import('./adminPinService')>('./adminPinService')), fetchPinStatus: () => pin.status() }));
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
  pin.status.mockReset().mockResolvedValue({ enabled: true, locked: false, retryAfter: 0 });
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

  const nextBtn = () => within(screen.getByRole('dialog')).getByRole('button', { name: '다음' });
  const pressCode = (code: string) => {
    for (const d of code) fireEvent.click(screen.getByRole('button', { name: d }));
  };
  const openRemove = async () => {
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: /여행자/ }));
    fireEvent.click(screen.getByRole('button', { name: '강제 탈퇴' }));
  };

  it('강제 탈퇴는 사유를 골라 다음으로 가면 보안코드 6자리를 묻고, 6번째 숫자를 누르면 사유·코드와 함께 요청한다', async () => {
    await openRemove();
    expect(state.remove).not.toHaveBeenCalled();
    // 사유를 고르기 전에는 다음이 막혀 있다
    expect(nextBtn()).toBeDisabled();
    fireEvent.change(screen.getByLabelText('정지 사유'), { target: { value: 'spam' } });
    fireEvent.click(nextBtn());
    expect(screen.getByText('보안코드 6자리를 눌러 주세요')).toBeInTheDocument();
    pressCode('48291');
    expect(state.remove).not.toHaveBeenCalled(); // 5자리까지는 보내지 않는다
    pressCode('5');
    await waitFor(() => expect(state.remove).toHaveBeenCalledWith('u1', 'spam', undefined, '482915'));
  });

  it("'직접 입력'을 고르면 글을 써야 다음으로 가고, 쓴 글이 사유로 서버에 간다", async () => {
    await openRemove();
    fireEvent.change(screen.getByLabelText('정지 사유'), { target: { value: 'custom' } });
    expect(nextBtn()).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/사유 입력/), { target: { value: '   ' } });
    expect(nextBtn()).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/사유 입력/), { target: { value: '  같은 글 반복  ' } });
    fireEvent.click(nextBtn());
    pressCode('482915');
    await waitFor(() => expect(state.remove).toHaveBeenCalledWith('u1', 'custom', '같은 글 반복', '482915'));
  });

  it('보안코드가 틀리면 창을 닫지 않고 남은 횟수를 알려 주며, 입력은 지워진다', async () => {
    const { AdminRemoveMemberError } = await import('./adminService');
    state.remove.mockRejectedValue(new AdminRemoveMemberError('wrong_pin', { attemptsLeft: 3 }));
    await openRemove();
    fireEvent.change(screen.getByLabelText('정지 사유'), { target: { value: 'abuse' } });
    fireEvent.click(nextBtn());
    pressCode('000111');
    expect(await screen.findByText(/3번 더 틀리면 15분 동안 잠겨요/)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '6자리 중 0자리 입력' })).toBeInTheDocument();
    // 다시 눌러 볼 수 있다
    state.remove.mockResolvedValue(undefined);
    pressCode('482915');
    await waitFor(() => expect(state.remove).toHaveBeenCalledTimes(2));
  });

  it('잠겨 있으면 숫자 버튼이 막히고 남은 시간이 보인다', async () => {
    const { AdminRemoveMemberError } = await import('./adminService');
    state.remove.mockRejectedValue(new AdminRemoveMemberError('locked', { retryAfter: 600 }));
    await openRemove();
    fireEvent.change(screen.getByLabelText('정지 사유'), { target: { value: 'abuse' } });
    fireEvent.click(nextBtn());
    pressCode('482915');
    expect(await screen.findByText(/10:00/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1' })).toBeDisabled();
  });

  it('보안코드를 쓸 수 없게 꺼져 있으면 사유만 고르고 바로 탈퇴시킨다(서버가 15분 로그인 규칙으로 확인)', async () => {
    pin.status.mockResolvedValue({ enabled: false, locked: false, retryAfter: 0 });
    await openRemove();
    fireEvent.change(screen.getByLabelText('정지 사유'), { target: { value: 'spam' } });
    fireEvent.click(await screen.findByRole('button', { name: '탈퇴시키기' }));
    await waitFor(() => expect(state.remove).toHaveBeenCalledWith('u1', 'spam', undefined, undefined));
  });

  it('탈퇴가 끝나면 다시 불러오기를 기다리지 않고 그 회원 줄이 바로 사라진다', async () => {
    state.remove.mockImplementation(async () => {
      // 서버에서는 이미 지워졌으니 이후 목록 조회는 비어 있다
      state.list.mockResolvedValue({ rows: [], total: 0 });
    });
    await openRemove();
    fireEvent.change(screen.getByLabelText('정지 사유'), { target: { value: 'spam' } });
    fireEvent.click(nextBtn());
    pressCode('482915');
    await waitFor(() => expect(screen.queryByText('traveler@example.com')).not.toBeInTheDocument());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('이용 정지 계정 목록에는 지금 정지 중인 줄만 보이고, 해제하면 그 줄이 바로 사라진다(기록은 정지 기록 화면)', async () => {
    state.suspensions.mockResolvedValue([
      { id: 7, email: 'bad@example.com', display_name: '나쁜사람', reason: 'fraud', reason_text: null, suspended_at: '2026-10-06T12:47:00Z', lifted_at: null },
      { id: 6, email: 'old@example.com', display_name: null, reason: 'custom', reason_text: '반복 도배', suspended_at: '2026-10-01T12:47:00Z', lifted_at: '2026-10-02T12:47:00Z' },
    ]);
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: /이용 정지 계정 \(1\)/ }));
    expect(await screen.findByText('bad@example.com')).toBeInTheDocument();
    expect(screen.getByText(/사기·허위 정보/)).toBeInTheDocument();
    // 이미 해제된 줄은 이 목록에 없다
    expect(screen.queryByText('old@example.com')).not.toBeInTheDocument();
    expect(screen.queryByText(/반복 도배/)).not.toBeInTheDocument();
    // 서버가 끝나기 전에도 줄이 먼저 사라진다
    let finish: () => void = () => undefined;
    state.lift.mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)));
    fireEvent.click(screen.getByRole('button', { name: '정지 해제' }));
    expect(state.lift).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '해제하기' }));
    await waitFor(() => expect(state.lift).toHaveBeenCalledWith(7));
    await waitFor(() => expect(screen.queryByText('bad@example.com')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: /이용 정지 계정 \(0\)/ })).toBeInTheDocument();
    finish();
  });

  it('해제가 실패하면 줄이 다시 나타난다', async () => {
    state.suspensions.mockResolvedValue([
      { id: 7, email: 'bad@example.com', display_name: '나쁜사람', reason: 'fraud', reason_text: null, suspended_at: '2026-10-06T12:47:00Z', lifted_at: null },
    ]);
    state.lift.mockRejectedValue(new Error('boom'));
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: /이용 정지 계정 \(1\)/ }));
    fireEvent.click(await screen.findByRole('button', { name: '정지 해제' }));
    fireEvent.click(screen.getByRole('button', { name: '해제하기' }));
    await waitFor(() => expect(state.lift).toHaveBeenCalled());
    expect(await screen.findByText('bad@example.com')).toBeInTheDocument();
  });
});
