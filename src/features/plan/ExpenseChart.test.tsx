import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ExpenseChart } from './ExpenseChart';

describe('ExpenseChart', () => {
  it('데이터가 없으면 빈 상태 문구를 보여준다', () => {
    render(<ExpenseChart title="일자별 합계" data={[]} currency="KRW" />);
    expect(screen.getByText('표시할 내용이 없어요')).toBeInTheDocument();
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
    expect(screen.getByText('₩20,000')).toBeInTheDocument();
    expect(screen.getByText('교통')).toBeInTheDocument();
    expect(screen.getByText('₩5,000')).toBeInTheDocument();
  });

  it('pageSize를 주면 그 개수씩 쪽으로 나누고 점으로 이동한다', () => {
    const data = Array.from({ length: 12 }, (_, i) => ({ label: `Day ${i + 1}`, value: (i + 1) * 1000 }));
    render(<ExpenseChart title="일자별 합계" data={data} currency="KRW" pageSize={5} />);
    const groups = screen.getAllByRole('group', { name: /쪽/ });
    expect(groups).toHaveLength(3);
    expect(groups[0]).toHaveTextContent('Day 1');
    expect(groups[0]).toHaveTextContent('Day 5');
    expect(groups[0]).not.toHaveTextContent('Day 6');
    expect(groups[2]).toHaveTextContent('Day 12');
    expect(screen.getAllByRole('button', { name: /쪽/ })).toHaveLength(3);
  });

  it('항목이 pageSize 이하이면 나누지 않는다', () => {
    const data = Array.from({ length: 5 }, (_, i) => ({ label: `Day ${i + 1}`, value: 1000 }));
    render(<ExpenseChart title="일자별 합계" data={data} currency="KRW" pageSize={5} />);
    expect(screen.queryAllByRole('group')).toHaveLength(0);
    expect(screen.getByText('Day 5')).toBeInTheDocument();
  });
});
