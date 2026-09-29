import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearInvalid, flagInvalid } from './invalidField';
import { ExpenseModal } from '@/features/plan/ExpenseModal';

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true });
});

describe('flagInvalid', () => {
  it('비어 있는 필드에 표시를 달고 첫 필드로 포커스·진동하며, 값을 고치면 저절로 지운다', () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    render(
      <>
        <input aria-label="a" />
        <input aria-label="b" />
      </>,
    );
    const a = screen.getByLabelText('a');
    const b = screen.getByLabelText('b');

    flagInvalid(a, b);
    expect(a).toHaveAttribute('data-invalid', 'true');
    expect(a).toHaveAttribute('aria-invalid', 'true');
    expect(b).toHaveAttribute('data-invalid', 'true');
    expect(a).toHaveFocus();
    expect(vibrate).toHaveBeenCalledTimes(1);

    fireEvent.change(a, { target: { value: 'x' } });
    expect(a).not.toHaveAttribute('data-invalid');
    expect(a).not.toHaveAttribute('aria-invalid');
    expect(b).toHaveAttribute('data-invalid', 'true');
  });

  it('감싸는 요소를 넘기면 안쪽 첫 입력에 포커스하고, clearInvalid로 되돌린다', () => {
    render(
      <div data-testid="box">
        <button type="button">pick</button>
      </div>,
    );
    const box = screen.getByTestId('box');
    flagInvalid(box);
    expect(box).toHaveAttribute('data-invalid', 'true');
    expect(screen.getByRole('button', { name: 'pick' })).toHaveFocus();
    clearInvalid(box);
    expect(box).not.toHaveAttribute('data-invalid');
  });

  it('null·화면에서 떨어진 요소만 넘겨도 오류 없이 지나간다', () => {
    expect(() => flagInvalid(null, undefined, document.createElement('input'))).not.toThrow();
  });
});

describe('경비 등록 — 이름·금액이 비면 빨간 테두리', () => {
  it('이름이 비어 있으면 저장하지 않고 이름 칸만 표시, 입력하면 해제', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <ExpenseModal currentDay={1} totalDays={2} currency="KRW" expensesData={{}} onClose={() => {}} onSave={onSave} />,
    );
    const [desc, amount] = screen.getAllByRole('textbox').concat(screen.getAllByRole('spinbutton'));
    fireEvent.change(amount, { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: '추가' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(desc).toHaveAttribute('data-invalid', 'true');
    expect(amount).not.toHaveAttribute('data-invalid');

    fireEvent.change(desc, { target: { value: '점심' } });
    expect(desc).not.toHaveAttribute('data-invalid');
    fireEvent.click(screen.getByRole('button', { name: '추가' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: '추가' })).toBeEnabled());
  });
});
