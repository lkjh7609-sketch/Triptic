import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchPinStatus, submitAdminPin } = vi.hoisted(() => ({ fetchPinStatus: vi.fn(), submitAdminPin: vi.fn() }));
vi.mock('./adminPinService', async () => ({
  ...(await vi.importActual<typeof import('./adminPinService')>('./adminPinService')),
  fetchPinStatus,
  submitAdminPin,
}));

import { AdminPinPad } from './AdminPinPad';

const press = (digits: string) => {
  for (const d of digits) fireEvent.click(screen.getByRole('button', { name: d }));
};

beforeEach(() => {
  fetchPinStatus.mockReset().mockResolvedValue({ enabled: true, locked: false, retryAfter: 0 });
  submitAdminPin.mockReset();
});

describe('AdminPinPad', () => {
  it('숫자 버튼 10개와 지우기 버튼이 있고, 6번째를 누르면 바로 보낸다', async () => {
    submitAdminPin.mockResolvedValue({ ok: true });
    render(<AdminPinPad />);
    await waitFor(() => expect(screen.getByRole('button', { name: '5' })).toBeEnabled());
    for (const d of '0123456789') expect(screen.getByRole('button', { name: d })).toBeInTheDocument();
    press('385204');
    await waitFor(() => expect(submitAdminPin).toHaveBeenCalledWith('385204'));
    expect(submitAdminPin).toHaveBeenCalledTimes(1);
  });

  it('5자리까지는 보내지 않고, 지우기로 한 자리씩 지운다', async () => {
    render(<AdminPinPad />);
    await waitFor(() => expect(screen.getByRole('button', { name: '1' })).toBeEnabled());
    press('12345');
    expect(submitAdminPin).not.toHaveBeenCalled();
    expect(screen.getByRole('img', { name: /5/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '한 자리 지우기' }));
    expect(screen.getByRole('img', { name: /4/ })).toBeInTheDocument();
  });

  it('틀리면 남은 횟수를 알리고 입력을 비운다', async () => {
    submitAdminPin.mockResolvedValue({ ok: false, kind: 'wrong', attemptsLeft: 3 });
    render(<AdminPinPad />);
    await waitFor(() => expect(screen.getByRole('button', { name: '1' })).toBeEnabled());
    press('000001');
    expect(await screen.findByText(/3번 더 틀리면 15분 동안 잠겨요/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /0/ })).toBeInTheDocument();
  });

  it('마지막 기회까지 틀리면 잠금 카운트다운이 뜨고 버튼이 막힌다', async () => {
    submitAdminPin.mockResolvedValue({ ok: false, kind: 'wrong', attemptsLeft: 0, retryAfter: 900 });
    render(<AdminPinPad />);
    await waitFor(() => expect(screen.getByRole('button', { name: '1' })).toBeEnabled());
    press('000001');
    expect(await screen.findByText(/15:00 뒤에 다시 시도/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1' })).toBeDisabled();
  });

  it('처음부터 잠겨 있으면(다른 사람이 틀렸어도 전역) 남은 시간을 보이고 누를 수 없다', async () => {
    fetchPinStatus.mockResolvedValue({ enabled: true, locked: true, retryAfter: 600 });
    render(<AdminPinPad />);
    expect(await screen.findByText(/10:00 뒤에 다시 시도/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '7' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '7' }));
    expect(submitAdminPin).not.toHaveBeenCalled();
  });

  it('서버에서 비밀번호 로그인이 꺼져 있으면 키패드 대신 안내', async () => {
    fetchPinStatus.mockResolvedValue({ enabled: false, locked: false, retryAfter: 0 });
    render(<AdminPinPad />);
    expect(await screen.findByText(/비밀번호 로그인을 지금은 쓸 수 없어요/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '5' })).not.toBeInTheDocument();
  });
});
