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
