import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ExpenseChart } from './ExpenseChart';

describe('ExpenseChart', () => {
  it('데이터가 없으면 빈 상태 문구를 보여준다', () => {
    render(<ExpenseChart title="일자별 합계" data={[]} currency="KRW" />);
    expect(screen.getByText('표시할 데이터가 없습니다.')).toBeInTheDocument();
  });

  it('항목별로 라벨과 금액을 렌더링한다', () => {
    render(
      <ExpenseChart
        title="카테고리별 합계"
        data={[
          { label: '식비', value: 20000 },
          { label: '교통', value: 5000 },
        ]}
        currency="KRW"
      />,
    );
    expect(screen.getByText('식비')).toBeInTheDocument();
    expect(screen.getByText('20,000원')).toBeInTheDocument();
    expect(screen.getByText('교통')).toBeInTheDocument();
    expect(screen.getByText('5,000원')).toBeInTheDocument();
  });
});
