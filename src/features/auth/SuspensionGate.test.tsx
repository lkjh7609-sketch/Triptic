import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/shared/i18n';

const h = vi.hoisted(() => ({
  listener: null as null | ((event: string, session: { user: { id: string } } | null) => void),
  check: vi.fn(),
  signOut: vi.fn(),
  localSignOut: vi.fn(),
}));
vi.mock('@/shared/api/authService', () => ({
  onAuthStateChange: (cb: typeof h.listener) => {
    h.listener = cb;
    return { unsubscribe: () => {} };
  },
  checkMySuspension: () => h.check(),
  signOut: () => h.signOut(),
}));
vi.mock('@/shared/api/supabaseClient', () => ({ getSupabaseClient: () => ({ auth: { signOut: h.localSignOut } }) }));
vi.mock('@/shared/monitoring', () => ({ captureError: vi.fn() }));

import { SuspensionGate } from './SuspensionGate';

async function login(id = 'u1') {
  await act(async () => {
    h.listener?.('SIGNED_IN', { user: { id } });
    await new Promise((r) => setTimeout(r, 5));
  });
}

beforeEach(() => {
  h.listener = null;
  h.check.mockReset().mockResolvedValue(null);
  h.signOut.mockReset().mockResolvedValue(undefined);
  h.localSignOut.mockReset().mockResolvedValue(undefined);
});

describe('SuspensionGate', () => {
  it('정지된 이메일로 로그인하면 로그아웃시키고 사유·조치 시각을 알리는 팝업을 띄운다', async () => {
    h.check.mockResolvedValue({ reason: 'fraud', reasonText: null, suspendedAt: '2026-10-06T12:47:00Z' });
    render(<SuspensionGate />);
    await login();
    expect(h.signOut).toHaveBeenCalledTimes(1);
    expect(screen.getByText('아래 사유에 의해 이용 정지된 계정입니다.')).toBeInTheDocument();
    expect(screen.getByText('사기·허위 정보')).toBeInTheDocument();
    expect(screen.getByText('조치 일시')).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });

  it('직접 입력한 사유는 쓴 글 그대로 보여 준다', async () => {
    h.check.mockResolvedValue({ reason: 'custom', reasonText: '같은 글을 반복해서 올렸어요', suspendedAt: '2026-10-06T12:47:00Z' });
    render(<SuspensionGate />);
    await login();
    expect(screen.getByText('같은 글을 반복해서 올렸어요')).toBeInTheDocument();
  });

  it('정지되지 않았으면 아무것도 하지 않는다', async () => {
    render(<SuspensionGate />);
    await login();
    expect(h.signOut).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('같은 사용자는 한 번만 확인하고, 모르는 사유 코드는 이용약관 위반으로 보여 준다', async () => {
    h.check.mockResolvedValue({ reason: 'something-new', reasonText: null, suspendedAt: '2026-10-06T12:47:00Z' });
    render(<SuspensionGate />);
    await login();
    await login();
    expect(h.check).toHaveBeenCalledTimes(1);
    expect(screen.getByText('그 밖의 이용약관 위반')).toBeInTheDocument();
  });

  it('로그아웃 요청이 실패해도 이 기기의 로그인은 반드시 지운다', async () => {
    h.check.mockResolvedValue({ reason: 'abuse', reasonText: null, suspendedAt: '2026-10-06T12:47:00Z' });
    h.signOut.mockRejectedValue(new Error('offline'));
    render(<SuspensionGate />);
    await login();
    expect(h.localSignOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('확인에 실패하면(회선 문제) 다음 로그인 이벤트에서 다시 확인한다', async () => {
    h.check.mockRejectedValueOnce(new Error('network')).mockResolvedValue(null);
    render(<SuspensionGate />);
    await login();
    await login();
    expect(h.check).toHaveBeenCalledTimes(2);
  });
});
