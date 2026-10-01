import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@/shared/i18n';

const { desktop } = vi.hoisted(() => ({ desktop: { value: true } }));
vi.mock('@/shared/hooks/useMediaQuery', () => ({ useMediaQuery: () => desktop.value }));

import { DateRangeDialog } from './DateRangeDialog';

const empty = { start: null, end: null, tbd: false };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(new Date(2026, 9, 15, 12)); // 2026-10-15
  desktop.value = true;
});
afterEach(() => {
  act(() => {
    vi.runOnlyPendingTimers();
  });
  vi.useRealTimers();
});

const day = (ymdLabel: RegExp) => screen.getByRole('button', { name: ymdLabel });

describe('DateRangeDialog', () => {
  it('PC: 두 달이 나란히 보이고, 출발일·복귀일을 차례로 누르면 박·일 수와 완료 버튼 문구가 나온다', async () => {
    const onConfirm = vi.fn();
    render(<DateRangeDialog value={empty} onConfirm={onConfirm} onClose={vi.fn()} />);
    expect(screen.getByRole('group', { name: '2026년 10월' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '2026년 11월' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '날짜를 선택해 주세요' })).toBeDisabled();

    fireEvent.click(day(/2026년 10월 20일/));
    fireEvent.click(day(/2026년 10월 24일/));
    expect(screen.getByText('4박 5일')).toBeInTheDocument();
    expect(screen.getByText('2026. 10. 20 (화)')).toBeInTheDocument();
    const confirm = screen.getByRole('button', { name: /선택 완료/ });
    expect(confirm).toHaveTextContent('10.20(화) - 10.24(토) 선택 완료 (4박 5일)');

    fireEvent.click(confirm);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(onConfirm).toHaveBeenCalledWith({ start: '2026-10-20', end: '2026-10-24', tbd: false });
  });

  it('오늘 이전 날짜는 고를 수 없다', () => {
    render(<DateRangeDialog value={empty} onConfirm={vi.fn()} onClose={vi.fn()} />);
    expect(day(/2026년 10월 14일/)).toBeDisabled();
    expect(day(/2026년 10월 15일/)).toBeEnabled();
  });

  it('출발일보다 앞 날을 누르면 그 날이 새 출발일이 된다', () => {
    render(<DateRangeDialog value={empty} onConfirm={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(day(/2026년 10월 20일/));
    fireEvent.click(day(/2026년 10월 17일/));
    expect(screen.getByText('2026. 10. 17 (토)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '날짜를 선택해 주세요' })).toBeDisabled();
  });

  it('날짜 미정 / 협의 가능 — 켜면 날짜 없이 완료할 수 있다', async () => {
    const onConfirm = vi.fn();
    render(<DateRangeDialog value={empty} onConfirm={onConfirm} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '날짜 미정 / 협의 가능' }));
    fireEvent.click(screen.getByRole('button', { name: '날짜 미정으로 선택 완료' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(onConfirm).toHaveBeenCalledWith({ start: null, end: null, tbd: true });
  });

  it('날짜 미정을 켠 뒤 날짜를 누르면 미정이 꺼지고, 선택 초기화는 모두 비운다', () => {
    render(<DateRangeDialog value={{ start: null, end: null, tbd: true }} onConfirm={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: '날짜 미정 / 협의 가능' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(day(/2026년 10월 20일/));
    expect(screen.getByRole('button', { name: '날짜 미정 / 협의 가능' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: '선택 초기화' }));
    expect(screen.queryByText('2026. 10. 20 (화)')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '날짜를 선택해 주세요' })).toBeDisabled();
  });

  it('다음 달 버튼으로 두 달씩 넘기고, 이번 달 앞으로는 못 간다', () => {
    render(<DateRangeDialog value={empty} onConfirm={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: '이전 달' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '다음 달' }));
    expect(screen.queryByRole('group', { name: '2026년 10월' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: '2026년 12월' })).toBeInTheDocument();
  });

  it('모바일: 같은 내용이 하단 시트로, 달이 세로로 이어진다(두 달 넘게 보임)', () => {
    desktop.value = false;
    render(<DateRangeDialog value={empty} onConfirm={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('group', { name: '2026년 10월' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '2027년 3월' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '다음 달' })).not.toBeInTheDocument();
  });

  it('닫기는 아무것도 바꾸지 않고 닫는다. 빠른 설정·시간대 선호는 없다', async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(<DateRangeDialog value={empty} onConfirm={onConfirm} onClose={onClose} />);
    expect(screen.queryByText(/빠른 설정|시간대 선호/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('닫기', { selector: 'button' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
