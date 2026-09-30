import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ForkDialog } from './ForkDialog';

describe('ForkDialog', () => {
  it('원본 출발일이 이미 지났으면 내일부터 시작하고, 고른 날짜로 확인한다', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<ForkDialog originalStart="2020-01-01" totalDays={3} onConfirm={onConfirm} onClose={onClose} />);
    const input = screen.getByLabelText('출발일') as HTMLInputElement;
    expect(input.value >= new Date().toISOString().slice(0, 10)).toBe(true);
    fireEvent.change(input, { target: { value: '2099-05-10' } });
    expect(screen.getByText('2099-05-10 ~ 2099-05-12 (3일)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '복제하기' }));
    expect(onConfirm).toHaveBeenCalledWith('2099-05-10');
    expect(onClose).toHaveBeenCalled();
  });

  it('배경을 눌러도 닫히지 않는다(취소 버튼으로만)', () => {
    const onClose = vi.fn();
    const { container } = render(<ForkDialog originalStart="2099-01-01" totalDays={2} onConfirm={() => {}} onClose={onClose} />);
    fireEvent.click(container.firstChild as Element);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '그냥 둘러보기' }));
    expect(onClose).toHaveBeenCalled();
  });
});
