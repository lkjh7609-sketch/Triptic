import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/shared/i18n';
import { CompanionFeedList } from './CompanionFeedList';
import type { CompanionPost, MyCompanionPost } from './types';

const { state } = vi.hoisted(() => ({
  state: { user: null as { id: string } | null, feed: [] as unknown[], mine: [] as unknown[] },
}));

vi.mock('@/shared/hooks/useSession', () => ({ useSession: () => ({ user: state.user }) }));
vi.mock('@/features/auth/loginPrompt', () => ({ useRequireLogin: () => () => true }));
vi.mock('./hooks/useCompanionPosts', () => ({
  useCompanionPostsFeed: () => ({
    data: { pages: [{ posts: state.feed }] },
    isLoading: false,
    isError: false,
    hasNextPage: false,
  }),
  useMyActiveCompanionPosts: () => ({ data: state.mine, isLoading: false, isError: false }),
}));

function post(over: Partial<CompanionPost> = {}): CompanionPost {
  return {
    id: 'c1',
    author_id: 'other',
    destination_id: null,
    title: '남의 모집글',
    body: '같이 가요',
    start_date: null,
    end_date: null,
    group_size: 2,
    status: 'recruiting',
    report_count: 0,
    matched_at: null,
    created_at: new Date().toISOString(),
    updated_at: '',
    deleted_at: null,
    author: { id: 'other', display_name: '남', avatar_url: null, bio: null, is_admin: false },
    ...over,
  };
}

function renderList(hostingOnly = false) {
  render(
    <MemoryRouter>
      <CompanionFeedList hostingOnly={hostingOnly} />
    </MemoryRouter>,
  );
}

describe('CompanionFeedList', () => {
  beforeEach(() => {
    state.user = { id: 'me' };
    state.feed = [post(), post({ id: 'c2', author_id: 'me', title: '내 모집글' })];
    state.mine = [
      { ...post({ id: 'c2', author_id: 'me', title: '내 모집글' }), needsReview: false },
      { ...post({ id: 'c3', author_id: 'me', status: 'matched', title: '확정된 내 글' }), needsReview: false },
      { ...post({ id: 'c4', author_id: 'other', status: 'recruiting', title: '신청한 남의 글' }), needsReview: false },
    ] as MyCompanionPost[];
  });

  it('공개 피드와 내 동행 줄 어디에도 내가 모집 중인 글은 나오지 않는다(내 동행모집 버튼에서만)', () => {
    renderList();
    expect(screen.getByText('남의 모집글')).toBeInTheDocument();
    expect(screen.queryByText('내 모집글')).not.toBeInTheDocument();
    // 내 동행 줄에는 확정된 글·신청한 글만
    expect(screen.getByText('확정된 내 글')).toBeInTheDocument();
    expect(screen.getByText('신청한 남의 글')).toBeInTheDocument();
  });

  it('내 동행모집 보기에는 내가 쓴, 모집 중인 글만 나온다', () => {
    renderList(true);
    expect(screen.getByText('내 모집글')).toBeInTheDocument();
    expect(screen.queryByText('확정된 내 글')).not.toBeInTheDocument();
    expect(screen.queryByText('신청한 남의 글')).not.toBeInTheDocument();
    expect(screen.queryByText('남의 모집글')).not.toBeInTheDocument();
  });

  it('비로그인이면 피드의 모든 글을 보여 준다', () => {
    state.user = null;
    renderList();
    expect(screen.getByText('남의 모집글')).toBeInTheDocument();
    expect(screen.getByText('내 모집글')).toBeInTheDocument();
  });
});
