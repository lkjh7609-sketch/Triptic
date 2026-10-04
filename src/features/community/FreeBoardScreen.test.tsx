import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/shared/i18n';

const state = vi.hoisted(() => ({ posts: [] as unknown[], args: null as unknown }));

vi.mock('@/shared/hooks/useSession', () => ({ useSession: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/features/auth/loginPrompt', () => ({ useRequireLogin: () => () => true }));
vi.mock('./channel/ChannelPostCard', () => ({ ChannelPostCard: ({ post }: { post: { id: string; title: string } }) => <div>{post.title}</div> }));
vi.mock('./hooks/useDestinationChannel', () => ({
  useChannelPosts: (args: unknown) => {
    state.args = args;
    return {
      data: { pages: [{ posts: state.posts }] },
      isLoading: false,
      isError: false,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      refetch: vi.fn(),
    };
  },
}));

import { FreeBoardScreen } from './FreeBoardScreen';

beforeEach(() => {
  state.posts = [];
  state.args = null;
});

function renderScreen() {
  return render(
    <MemoryRouter>
      <FreeBoardScreen />
    </MemoryRouter>,
  );
}

describe('FreeBoardScreen', () => {
  it('도시 없는 글만 불러오고(freeBoard), 글이 없으면 첫 글 쓰기를 안내한다', () => {
    renderScreen();
    expect(screen.getByRole('heading', { level: 1, name: '자유게시판' })).toBeInTheDocument();
    expect(state.args).toMatchObject({ freeBoard: true, destinationId: undefined });
    expect(screen.getByText('아직 자유게시판에 글이 없어요.')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /첫 글|글쓰기|쓰기/ })[0]).toHaveAttribute('href', '/community/compose?board=free');
  });

  it('글이 있으면 카드로 보여 준다', () => {
    state.posts = [{ id: 'p1', title: '자유 글 제목' }];
    renderScreen();
    expect(screen.getByText('자유 글 제목')).toBeInTheDocument();
  });
});
