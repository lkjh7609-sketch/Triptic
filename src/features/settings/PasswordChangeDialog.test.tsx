import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/shared/i18n';

const state = vi.hoisted(() => ({ change: vi.fn() }));
vi.mock('@/shared/api/authService', () => ({ changePassword: (...a: unknown[]) => state.change(...a) }));
vi.mock('@/shared/a11y/useFocusTrap', () => ({ useFocusTrap: () => ({ current: null }) }));
vi.mock('@/shared/ui/toast', () => ({ showToast: vi.fn() }));

import { PasswordChangeDialog } from './PasswordChangeDialog';

beforeEach(() => state.change.mockReset().mockResolvedValue(undefined));

describe('PasswordChangeDialog', () => {
  it.each([
    ['kakao', '카카오로 가입했어요'],
    ['google', '구글로 가입했어요'],
    ['apple', '애플로 가입했어요'],
  ])('%s로 가입한 회원은 안내가 뜨고 변경은 비활성화된다', (provider, text) => {
    render(<PasswordChangeDialog provider={provider} onClose={vi.fn()} />);
    expect(screen.getByText(new RegExp(text))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '변경하기' })).toBeDisabled();
    expect(screen.getByLabelText('새 비밀번호')).toBeDisabled();
  });

  it('이메일 가입 회원은 8자 이상·두 칸 일치일 때만 바꾼다', async () => {
    const onClose = vi.fn();
    render(<PasswordChangeDialog provider="email" onClose={onClose} />);
    fireEvent.change(screen.getByLabelText('새 비밀번호'), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText('새 비밀번호 확인'), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: '변경하기' }));
    expect(screen.getByRole('alert')).toHaveTextContent('8자 이상');
    expect(state.change).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('새 비밀번호'), { target: { value: 'longenough1' } });
    fireEvent.change(screen.getByLabelText('새 비밀번호 확인'), { target: { value: 'different11' } });
    fireEvent.click(screen.getByRole('button', { name: '변경하기' }));
    expect(screen.getByRole('alert')).toHaveTextContent('달라요');

    fireEvent.change(screen.getByLabelText('새 비밀번호 확인'), { target: { value: 'longenough1' } });
    fireEvent.click(screen.getByRole('button', { name: '변경하기' }));
    await waitFor(() => expect(state.change).toHaveBeenCalledWith('longenough1'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
