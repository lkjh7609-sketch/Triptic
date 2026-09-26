import type { ReactElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ExpenseModal } from './ExpenseModal';
import * as fxRates from './fxRates';

function renderWithQuery(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('ExpenseModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(fxRates, 'fetchFxRates').mockResolvedValue({
      perUsd: { USD: 1, KRW: 1350, JPY: 150 },
      newestAt: '2026-09-26T01:05:00Z',
    });
  });

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

  it('다른 통화로 입력하면 캐시된 1시간 환율로 fxRateToBase를 저장한다', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderWithQuery(
      <ExpenseModal currentDay={1} totalDays={3} currency="KRW" expensesData={{}} onClose={vi.fn()} onSave={onSave} />,
    );

    fireEvent.change(screen.getByPlaceholderText('사용처 (예: 점심 식사)'), { target: { value: '스시' } });
    fireEvent.change(screen.getByPlaceholderText(/금액/), { target: { value: '1000' } });
    fireEvent.change(screen.getByLabelText('통화'), { target: { value: 'JPY' } });
    await screen.findByText(/기준 환율/);
    fireEvent.click(screen.getByRole('button', { name: '추가' }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const saved = onSave.mock.calls[0][0][0];
    expect(saved).toMatchObject({ desc: '스시', amount: 1000, currency: 'JPY' });
    expect(saved.fxRateToBase).toBeCloseTo(9, 6);
    expect(fxRates.fetchFxRates).toHaveBeenCalledTimes(1);
  });

  it('해당 통화 환율이 없으면 저장은 되고 경고 문구를 보여준다', async () => {
    vi.spyOn(fxRates, 'fetchFxRates').mockResolvedValue({ perUsd: { USD: 1, KRW: 1350 }, newestAt: null });
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderWithQuery(
      <ExpenseModal currentDay={1} totalDays={3} currency="KRW" expensesData={{}} onClose={vi.fn()} onSave={onSave} />,
    );

    fireEvent.change(screen.getByPlaceholderText('사용처 (예: 점심 식사)'), { target: { value: '스시' } });
    fireEvent.change(screen.getByPlaceholderText(/금액/), { target: { value: '1000' } });
    fireEvent.change(screen.getByLabelText('통화'), { target: { value: 'JPY' } });
    fireEvent.click(screen.getByRole('button', { name: '추가' }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledWith([
      expect.objectContaining({ desc: '스시', amount: 1000, currency: 'JPY', fxRateToBase: null }),
    ]);
    expect(await screen.findByText(/아직 이 통화의 환율이 없어요/)).toBeInTheDocument();
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
