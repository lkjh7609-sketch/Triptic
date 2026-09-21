import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ExpenseModal } from './ExpenseModal';
import * as fxRate from './fxRate';

describe('ExpenseModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('여행 기본 통화로 입력하면 환율 조회 없이 바로 저장한다', async () => {
    const fetchSpy = vi.spyOn(fxRate, 'fetchDailyRate');
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <ExpenseModal currentDay={1} totalDays={3} currency="KRW" expensesData={{}} onClose={vi.fn()} onSave={onSave} />,
    );

    fireEvent.change(screen.getByPlaceholderText('사용처 (예: 점심 식사)'), { target: { value: '점심' } });
    fireEvent.change(screen.getByPlaceholderText(/금액/), { target: { value: '12000' } });
    fireEvent.click(screen.getByRole('button', { name: '추가' }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(onSave).toHaveBeenCalledWith([
      expect.objectContaining({ desc: '점심', amount: 12000, currency: 'KRW', category: 'other' }),
    ]);
  });

  it('다른 통화로 입력하면 환율을 조회해 fxRateToBase로 저장한다', async () => {
    vi.spyOn(fxRate, 'fetchDailyRate').mockResolvedValue(9.5);
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <ExpenseModal currentDay={1} totalDays={3} currency="KRW" expensesData={{}} onClose={vi.fn()} onSave={onSave} />,
    );

    fireEvent.change(screen.getByPlaceholderText('사용처 (예: 점심 식사)'), { target: { value: '스시' } });
    fireEvent.change(screen.getByPlaceholderText(/금액/), { target: { value: '1000' } });
    fireEvent.change(screen.getByLabelText('통화'), { target: { value: 'JPY' } });
    fireEvent.click(screen.getByRole('button', { name: /추가|환율 조회/ }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(fxRate.fetchDailyRate).toHaveBeenCalledWith('JPY', 'KRW');
    expect(onSave).toHaveBeenCalledWith([
      expect.objectContaining({ desc: '스시', amount: 1000, currency: 'JPY', fxRateToBase: 9.5 }),
    ]);
  });

  it('환율 조회 실패 시에도 저장은 되고 경고 문구를 보여준다', async () => {
    vi.spyOn(fxRate, 'fetchDailyRate').mockResolvedValue(null);
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <ExpenseModal currentDay={1} totalDays={3} currency="KRW" expensesData={{}} onClose={vi.fn()} onSave={onSave} />,
    );

    fireEvent.change(screen.getByPlaceholderText('사용처 (예: 점심 식사)'), { target: { value: '스시' } });
    fireEvent.change(screen.getByPlaceholderText(/금액/), { target: { value: '1000' } });
    fireEvent.change(screen.getByLabelText('통화'), { target: { value: 'JPY' } });
    fireEvent.click(screen.getByRole('button', { name: /추가|환율 조회/ }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledWith([
      expect.objectContaining({ desc: '스시', amount: 1000, currency: 'JPY', fxRateToBase: null }),
    ]);
    expect(await screen.findByText(/환율 조회에 실패했어요/)).toBeInTheDocument();
  });

  it('사용처나 금액이 비어있으면 저장하지 않는다', () => {
    const onSave = vi.fn();
    render(
      <ExpenseModal currentDay={1} totalDays={3} currency="KRW" expensesData={{}} onClose={vi.fn()} onSave={onSave} />,
    );
    fireEvent.click(screen.getByRole('button', { name: '추가' }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('기존 항목 삭제 시 해당 인덱스만 제외해 저장한다', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const expensesData = { 1: [{ desc: '점심', amount: 12000 }, { desc: '커피', amount: 5000 }] };
    render(
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
