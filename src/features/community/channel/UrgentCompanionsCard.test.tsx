import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import '@/shared/i18n';
import type { CompanionPost } from '../types';
import { UrgentCompanionsCard } from './ChannelSidebar';

function posts(n: number): CompanionPost[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${i + 1}`,
    title: `동행 ${i + 1}`,
    start_date: '2099-01-01',
    end_date: '2099-01-05',
    max_members: 4,
    member_count: 1,
  })) as unknown as CompanionPost[];
}

function renderCard(n: number) {
  return render(
    <MemoryRouter>
      <UrgentCompanionsCard posts={posts(n)} />
    </MemoryRouter>,
  );
}

describe('UrgentCompanionsCard', () => {
  it('3개 이하면 쪽 넘김 없이 전부 보인다', () => {
    renderCard(3);
    expect(screen.getAllByRole('link')).toHaveLength(3);
    expect(screen.queryByRole('button', { name: '다음 쪽' })).not.toBeInTheDocument();
  });

  it('4개부터는 3개씩 쪽 넘김', () => {
    renderCard(5);
    expect(screen.getAllByRole('link')).toHaveLength(3);
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '이전 쪽' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '다음 쪽' }));
    expect(screen.getAllByRole('link')).toHaveLength(2);
    expect(screen.getByText('동행 4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다음 쪽' })).toBeDisabled();
  });
});
