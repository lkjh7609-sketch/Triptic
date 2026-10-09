import { Suspense } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/shared/i18n';

const state = vi.hoisted(() => ({ history: vi.fn() }));
vi.mock('./adminService', async () => ({
  ...(await vi.importActual<typeof import('./adminService')>('./adminService')),
  adminSuspensionHistory: (...args: unknown[]) => state.history(...args),
}));

import { AdminSuspensionHistory } from './AdminSuspensionHistory';

const row = (over: Record<string, unknown>) => ({
  id: 1,
  email: 'bad@example.com',
  display_name: '나쁜사람',
  reason: 'fraud',
  reason_text: null,
  suspended_at: '2026-10-06T12:47:00Z',
  lifted_at: null,
  suspended_by_name: '관리자',
  lifted_by_name: null,
  ...over,
});

function renderScreen() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Suspense fallback={null}>
        <AdminSuspensionHistory />
      </Suspense>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  state.history.mockReset().mockResolvedValue({
    rows: [
      row({}),
      row({ id: 2, email: 'old@example.com', display_name: null, reason: 'custom', reason_text: '반복 도배', suspended_at: '2026-10-01T12:47:00Z', lifted_at: '2026-10-02T12:47:00Z', lifted_by_name: '관리자' }),
    ],
    total: 2,
  });
});

describe('AdminSuspensionHistory — 정지 기록(영구 내역)', () => {
  it('정지 중과 해제된 기록이 함께 보이고, 상태·사유·처리한 운영자가 나온다', async () => {
    renderScreen();
    expect(await screen.findByText('bad@example.com')).toBeInTheDocument();
    expect(screen.getByText('old@example.com')).toBeInTheDocument();
    expect(screen.getByText('정지 기록 2건')).toBeInTheDocument();
    expect(screen.getByText(/사기·허위 정보/)).toBeInTheDocument();
    expect(screen.getByText(/반복 도배/)).toBeInTheDocument();
    // 상태 칩: 정지 중 1, 해제됨 1
    expect(screen.getAllByText('정지 중')).toHaveLength(1);
    expect(screen.getAllByText('해제됨')).toHaveLength(1);
    expect(screen.getByText(/해제 · 관리자/, { selector: 'p' })).toBeInTheDocument();
  });

  it('처음엔 필터 없이 첫 쪽을 읽는다', async () => {
    renderScreen();
    await screen.findByText('bad@example.com');
    expect(state.history).toHaveBeenCalledWith({ query: '', status: '', reason: '', from: '', to: '' }, 0, 20);
  });

  it('상태·사유 알약을 누르면 바로 그 조건으로 다시 읽는다', async () => {
    renderScreen();
    await screen.findByText('bad@example.com');
    fireEvent.click(screen.getByRole('button', { name: /필터/ }));
    fireEvent.click(within(screen.getByRole('group', { name: '상태' })).getByRole('button', { name: '해제됨' }));
    await waitFor(() => expect(state.history).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'lifted' }), 0, 20));
    fireEvent.click(within(screen.getByRole('group', { name: '사유' })).getByRole('button', { name: '사기·허위 정보' }));
    await waitFor(() => expect(state.history).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'lifted', reason: 'fraud' }), 0, 20));
  });

  it('정지일 기간과 검색어(검색 버튼)도 적용된다', async () => {
    renderScreen();
    await screen.findByText('bad@example.com');
    fireEvent.change(screen.getByLabelText('이메일·이름·사유로 검색'), { target: { value: ' 도배 ' } });
    fireEvent.click(screen.getByRole('button', { name: '검색' }));
    await waitFor(() => expect(state.history).toHaveBeenLastCalledWith(expect.objectContaining({ query: '도배' }), 0, 20));
    fireEvent.click(screen.getByRole('button', { name: /필터/ }));
    const group = screen.getByRole('group', { name: '정지일' });
    fireEvent.change(within(group).getByLabelText('시작일'), { target: { value: '2026-10-01' } });
    fireEvent.change(within(group).getByLabelText('종료일'), { target: { value: '2026-10-05' } });
    await waitFor(() => expect(state.history).toHaveBeenLastCalledWith(expect.objectContaining({ query: '도배', from: '2026-10-01', to: '2026-10-05' }), 0, 20));
  });

  it('결과가 없으면 안내를 보여 준다', async () => {
    state.history.mockResolvedValue({ rows: [], total: 0 });
    renderScreen();
    expect(await screen.findByText('조건에 맞는 정지 기록이 없어요.')).toBeInTheDocument();
  });

  it('쪽 이동은 20건 단위 offset으로 다시 읽는다', async () => {
    state.history.mockResolvedValue({ rows: [row({})], total: 45 });
    renderScreen();
    await screen.findByText('bad@example.com');
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    await waitFor(() => expect(state.history).toHaveBeenLastCalledWith(expect.anything(), 1, 20));
  });

  it('읽기 전용 — 정지 해제·삭제 버튼이 없다(기록은 영구 보관)', async () => {
    renderScreen();
    await screen.findByText('bad@example.com');
    expect(screen.queryByRole('button', { name: /정지 해제|삭제/ })).not.toBeInTheDocument();
  });
});
