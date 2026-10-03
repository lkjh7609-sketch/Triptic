import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/shared/i18n';
import i18n from '@/shared/i18n';
import { ChannelPostCard } from './ChannelPostCard';
import type { Post } from '../types';

vi.mock('@/shared/hooks/useSession', () => ({ useSession: () => ({ user: null }) }));
vi.mock('../hooks/usePosts', () => ({
  useToggleLike: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('../BookmarkButton', () => ({ BookmarkButton: () => <button type="button">save</button> }));
vi.mock('../PostActionsMenu', () => ({
  PostActionsMenu: () => <button type="button">menu</button>,
}));

function post(over: Partial<Post> = {}): Post {
  return {
    id: 'p1',
    destination_id: 'd1',
    author_id: 'a1',
    body: '바투 동굴 계단 조심하세요\n오전 8시 반에 가면 빛내림이 예뻐요',
    language: 'ko',
    trip_id: null,
    status: 'published',
    like_count: 3,
    comment_count: 8,
    report_count: 0,
    created_at: new Date().toISOString(),
    updated_at: '',
    deleted_at: null,
    author: { id: 'a1', display_name: '준영', avatar_url: null } as Post['author'],
    category: 'story',
    tags: [],
    view_count: 0,
    pinned_at: null,
    accepted_comment_id: null,
    ...over,
  };
}

function renderCard(p: Post, onTagClick = vi.fn()) {
  render(
    <MemoryRouter>
      <ChannelPostCard post={p} onTagClick={onTagClick} />
    </MemoryRouter>,
  );
  return onTagClick;
}

beforeEach(async () => {
  await i18n.changeLanguage('ko');
});

describe('ChannelPostCard', () => {
  it('제목·발췌와 "시간 · 분류" 줄을 보여 준다', () => {
    renderCard(post());
    expect(screen.getByRole('heading', { name: '바투 동굴 계단 조심하세요' })).toBeInTheDocument();
    expect(screen.getByText('오전 8시 반에 가면 빛내림이 예뻐요')).toBeInTheDocument();
    expect(screen.getByText(/· 여행기·후기$/)).toBeInTheDocument();
  });

  it('태그를 누르면 글 상세로 가지 않고 태그 콜백만 부른다', () => {
    const onTagClick = renderCard(post({ tags: ['바투동굴', '아침'] }));
    fireEvent.click(screen.getByRole('button', { name: '#아침' }));
    expect(onTagClick).toHaveBeenCalledWith('아침');
    expect(screen.getByRole('link')).toHaveAttribute('href', '/community/post/p1');
  });

  it('질문 글은 답변 수·답변 작성하기가 붙고, 채택 답변이 있으면 보여 준다', () => {
    renderCard(
      post({
        category: 'qna',
        comment_count: 8,
        accepted_comment_id: 'c1',
        accepted_comment: {
          id: 'c1',
          body: '사이우를 추천해요',
          created_at: '',
          author: { id: 'x', display_name: '채린', avatar_url: null } as Post['author'],
        },
      }),
    );
    expect(screen.getByText('답변 8개')).toBeInTheDocument();
    expect(screen.getByText('답변 작성하기')).toBeInTheDocument();
    expect(screen.getByText('채린 님의 채택 답변')).toBeInTheDocument();
    expect(screen.getByText('사이우를 추천해요')).toBeInTheDocument();
  });

  it('질문이 아니면 답변 칸이 없다', () => {
    renderCard(post({ category: 'tips' }));
    expect(screen.queryByText(/답변/)).not.toBeInTheDocument();
  });

  it('채택된 댓글이 지워져 내용을 못 받았으면 채택 칸을 그리지 않는다', () => {
    renderCard(post({ category: 'qna', accepted_comment_id: 'c9', accepted_comment: undefined }));
    expect(screen.queryByText(/채택 답변/)).not.toBeInTheDocument();
    expect(screen.getByText('답변 8개')).toBeInTheDocument();
  });
});
