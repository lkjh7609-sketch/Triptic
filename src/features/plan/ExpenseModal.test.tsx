import type { ReactElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { ExpenseModal } from './ExpenseModal';

function renderWithQuery(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('ExpenseModal', () => {
  it('여행 기본 통화로 입력하면 환산 없이 그대로 저장한다', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderWithQuery(
      <ExpenseModal currentDay={1} totalDays={3} currency="KRW" expensesData={{}} onClose={vi.fn()} onSave={onSave} />,
    );

    fireEvent.change(screen.getByPlaceholderText('사용처 (예: 점심 식사)'), { target: { value: '점심' } });
    fireEvent.change(screen.getByPlaceholderText(/금액/), { target: { value: '12000' } });
    fireEvent.click(screen.getByRole('button', { name: '추가' }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const saved = onSave.mock.calls[0][0][0];
    expect(saved).toMatchObject({ desc: '점심', amount: 12000, currency: 'KRW', category: 'other' });
    expect(saved).not.toHaveProperty('fxRateToBase');
  });

  it('추가를 누르면 서버 저장이 끝나기 전에 줄과 합계가 먼저 생기고 입력칸이 비워진다', async () => {
    let finish: () => void = () => undefined;
    const onSave = vi.fn().mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)));
    renderWithQuery(
      <ExpenseModal currentDay={1} totalDays={3} currency="KRW" expensesData={{}} onClose={vi.fn()} onSave={onSave} />,
    );
    fireEvent.change(screen.getByPlaceholderText('사용처 (예: 점심 식사)'), { target: { value: '점심' } });
    fireEvent.change(screen.getByPlaceholderText(/금액/), { target: { value: '12000' } });
    fireEvent.click(screen.getByRole('button', { name: '추가' }));

    expect(await screen.findByText('점심')).toBeInTheDocument(); // 저장(아직 안 끝남)보다 줄이 먼저
    expect(screen.getByText('이 날 합계').nextElementSibling).toHaveTextContent('₩12,000');
    expect(screen.getByPlaceholderText('사용처 (예: 점심 식사)')).toHaveValue('');
    finish();
  });

  it('저장이 실패하면 줄이 사라지고 입력했던 내용이 돌아온다', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('boom'));
    renderWithQuery(
      <ExpenseModal currentDay={1} totalDays={3} currency="KRW" expensesData={{}} onClose={vi.fn()} onSave={onSave} />,
    );
    fireEvent.change(screen.getByPlaceholderText('사용처 (예: 점심 식사)'), { target: { value: '점심' } });
    fireEvent.change(screen.getByPlaceholderText(/금액/), { target: { value: '12000' } });
    fireEvent.click(screen.getByRole('button', { name: '추가' }));

    await waitFor(() => expect(screen.getByPlaceholderText('사용처 (예: 점심 식사)')).toHaveValue('점심'));
    expect(screen.getByPlaceholderText(/금액/)).toHaveValue(12000);
    expect(screen.queryByText('아직 등록된 경비가 없습니다.')).toBeInTheDocument();
  });

  it('삭제를 누르면 서버 저장이 끝나기 전에 그 줄이 먼저 사라진다', async () => {
    let finish: () => void = () => undefined;
    const onSave = vi.fn().mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)));
    renderWithQuery(
      <ExpenseModal currentDay={1} totalDays={3} currency="KRW" expensesData={{ 1: [{ desc: '택시', amount: 8000 }] }} onClose={vi.fn()} onSave={onSave} />,
    );
    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    await waitFor(() => expect(screen.queryByText('택시')).not.toBeInTheDocument());
    expect(onSave).toHaveBeenCalledWith([]);
    finish();
  });

  it('통화 선택칸이 없고 여행 통화로만 입력된다', () => {
    renderWithQuery(
      <ExpenseModal currentDay={1} totalDays={3} currency="JPY" expensesData={{}} onClose={vi.fn()} onSave={vi.fn()} />,
    );
    expect(screen.queryByLabelText('통화')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('금액 (¥)')).toBeInTheDocument();
  });

  it('일자별 합계는 5일씩 나눠 보여준다', () => {
    renderWithQuery(
      <ExpenseModal currentDay={1} totalDays={12} currency="KRW" expensesData={{ 1: [{ desc: '점심', amount: 1000 }] }} onClose={vi.fn()} onSave={vi.fn()} />,
    );
    expect(screen.getAllByRole('group', { name: /쪽/ })).toHaveLength(3);
  });

  it('사용처나 금액이 비어있으면 저장하지 않는다', () => {
    const onSave = vi.fn();
    renderWithQuery(
      <ExpenseModal currentDay={1} totalDays={3} currency="KRW" expensesData={{}} onClose={vi.fn()} onSave={onSave} />,
    );
    fireEvent.click(screen.getByRole('button', { name: '추가' }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('기존 항목 삭제 시 해당 인덱스만 제외해 저장한다', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const expensesData = { 1: [{ desc: '점심', amount: 12000 }, { desc: '커피', amount: 5000 }] };
    renderWithQuery(
      <ExpenseModal
        currentDay={1}
        totalDays={3}
        currency="KRW"
        expensesData={expensesData}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );
    fireEvent.click(screen.getAllByRole('button', { name: '삭제' })[0]);
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith([{ desc: '커피', amount: 5000 }]),
    );
  });
});
