import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@/shared/i18n';

const rejectLinkedLogin = vi.fn(async () => ({ unlinkError: null }));
let emit: (event: string, session: unknown) => void = () => {};

vi.mock('@/shared/api/authService', async () => {
  const actual = await vi.importActual<typeof import('@/shared/api/authService')>('@/shared/api/authService');
  return {
    ...actual,
    rejectLinkedLogin: (...args: unknown[]) => (rejectLinkedLogin as unknown as (...a: unknown[]) => unknown)(...args),
    onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
      emit = cb;
      return { unsubscribe: () => {} };
    },
  };
});

import { LoginConflictGate } from './LoginConflictGate';

const iso = (agoMs: number) => new Date(Date.now() - agoMs).toISOString();
const identity = (provider: string, createdAgo: number, signedAgo: number) => ({
  id: provider,
  identity_id: `${provider}-id`,
  provider,
  created_at: iso(createdAgo),
  last_sign_in_at: iso(signedAgo),
});

describe('LoginConflictGate — 이미 다른 방법으로 가입된 이메일', () => {
  beforeEach(() => rejectLinkedLogin.mockClear());

  it('새로 붙은 연결이 있으면 연결을 끊고 가입 방법·최근 로그인 방법을 팝업으로 알린다', async () => {
    render(<LoginConflictGate />);
    const day = 86_400_000;
    emit('SIGNED_IN', { user: { id: 'u1', identities: [identity('google', 30 * day, 2 * day), identity('kakao', 1000, 1000)] } });
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText(/Google(\(으\)|)로 이미 가입/)).toBeInTheDocument();
    expect(screen.getByText(/카카오(\(으\)|)로는 로그인되지 않았어요/)).toBeInTheDocument();
    expect(screen.getByText('최근 로그인 방법')).toBeInTheDocument();
    expect(rejectLinkedLogin).toHaveBeenCalledTimes(1);
  });

  it('처음 가입이나 예전부터 쓰던 방법이면 아무 팝업도 없다', async () => {
    render(<LoginConflictGate />);
    emit('SIGNED_IN', { user: { id: 'u2', identities: [identity('google', 1000, 1000)] } });
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(rejectLinkedLogin).not.toHaveBeenCalled();
  });
});
