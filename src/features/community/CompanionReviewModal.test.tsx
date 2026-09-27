import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CompanionPost } from './types';

const mutateAsync = vi.fn().mockResolvedValue(undefined);

vi.mock('@/shared/hooks/useSession', () => ({
  useSession: () => ({ user: { id: 'me' }, loading: false }),
}));

vi.mock('./hooks/useCompanionPosts', () => ({
  useCompanionMatchMembers: () => ({
    isLoading: false,
    data: [
      { user_id: 'host', role: 'organizer', profile: { display_name: '주최자A', is_admin: false } },
      { user_id: 'me', role: 'member', profile: { display_name: '나', is_admin: false } },
      { user_id: 'other', role: 'member', profile: { display_name: '멤버B', is_admin: false } },
    ],
  }),
  useSubmitCompanionReview: () => ({ mutateAsync, isPending: false }),
}));

const { CompanionReviewModal } = await import('./CompanionReviewModal');

const post = { id: 'p1', title: '오사카 1박2일', author_id: 'host', status: 'closed' } as CompanionPost;

describe('CompanionReviewModal', () => {
  it('마무리 여부와 나를 뺀 멤버 전원 별점을 모두 골라야 제출된다', async () => {
    render(<CompanionReviewModal post={post} onClose={vi.fn()} />);

    expect(screen.queryByText('나')).toBeNull();
    const submit = screen.getByRole('button', { name: '제출' });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: '네, 잘 마무리됐어요' }));
    fireEvent.click(screen.getAllByRole('radio', { name: '5점' })[0]);
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getAllByRole('radio', { name: '3점' })[1]);
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        wentWell: true,
        ratings: [
          { userId: 'host', rating: 5 },
          { userId: 'other', rating: 3 },
        ],
      }),
    );
    expect(await screen.findByText('후기를 남겨주셔서 고마워요')).toBeInTheDocument();
  });
});
