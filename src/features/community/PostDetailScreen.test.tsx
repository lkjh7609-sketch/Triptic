import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/shared/i18n';
import i18n from '@/shared/i18n';
import { PostDetailScreen } from './PostDetailScreen';
import type { Comment, Post } from './types';

const state = vi.hoisted(() => ({
  user: null as { id: string } | null,
  post: null as unknown,
  comments: [] as unknown[],
  admin: false,
  recordPostView: vi.fn(),
  setPinned: vi.fn(),
  setAccepted: vi.fn(),
}));

vi.mock('@/shared/hooks/useSession', () => ({ useSession: () => ({ user: state.user }) }));
vi.mock('@/shared/hooks/useProfile', () => ({ useProfile: () => ({ data: { locale: 'ko' } }) }));
vi.mock('./hooks/usePosts', () => ({
  usePost: () => ({ data: state.post, isLoading: false, isError: false, refetch: vi.fn() }),
  useDeletePost: () => ({ mutateAsync: vi.fn() }),
  useToggleLike: () => ({ mutate: vi.fn() }),
}));
vi.mock('./hooks/useComments', () => ({
  useComments: () => ({ data: state.comments }),
  useCreateComment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteComment: () => ({ mutate: vi.fn() }),
}));
vi.mock('./hooks/usePostMeta', () => ({
  useIsAdminViewer: () => ({ data: state.admin }),
  useSetPostPinned: () => ({ mutate: state.setPinned, isPending: false }),
  useSetAcceptedComment: () => ({ mutate: state.setAccepted, isPending: false }),
}));
vi.mock('./communityService', () => ({ recordPostView: (id: string) => state.recordPostView(id) }));
vi.mock('./BookmarkButton', () => ({ BookmarkButton: () => null }));
vi.mock('./PostActionsMenu', () => ({ PostActionsMenu: () => null }));
vi.mock('./editor/LightMarkdown', () => ({
  LightMarkdown: ({ text }: { text: string }) => <div>{text}</div>,
}));
vi.mock('@/features/auth/loginPrompt', () => ({ openLoginPrompt: vi.fn() }));
vi.mock('@/shared/ui/toast', () => ({ showToast: vi.fn() }));

function post(over: Partial<Post> = {}): Post {
  return {
    id: 'p1',
    destination_id: 'd1',
    author_id: 'asker',
    body: '질문 본문',
    language: 'ko',
    trip_id: null,
    status: 'published',
    like_count: 0,
    comment_count: 2,
    report_count: 0,
    created_at: new Date().toISOString(),
    updated_at: '',
    deleted_at: null,
    category: 'qna',
    tags: ['바투동굴'],
    view_count: 0,
    pinned_at: null,
    accepted_comment_id: null,
    ...over,
  } as Post;
}

const comment = (id: string, author_id: string): Comment => ({
  id,
  post_id: 'p1',
  author_id,
  parent_id: null,
  body: `댓글 ${id}`,
  status: 'published',
  created_at: new Date().toISOString(),
  deleted_at: null,
});

function renderScreen() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/community/post/p1']}>
        <Routes>
          <Route path="/community/post/:postId" element={<PostDetailScreen />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage('ko');
  state.user = null;
  state.post = post();
  state.comments = [comment('c1', 'helper'), comment('c2', 'asker')];
  state.admin = false;
  state.recordPostView.mockClear();
  state.setPinned.mockClear();
  state.setAccepted.mockClear();
});

describe('PostDetailScreen — 조회수', () => {
  it('로그인한 사용자가 공개 글을 열면 한 번 기록한다', () => {
    state.user = { id: 'viewer' };
    renderScreen();
    expect(state.recordPostView).toHaveBeenCalledTimes(1);
    expect(state.recordPostView).toHaveBeenCalledWith('p1');
  });

  it('비로그인은 읽을 수 있지만 조회수에는 안 넣는다', () => {
    renderScreen();
    expect(screen.getByText('질문 본문')).toBeInTheDocument();
    expect(state.recordPostView).not.toHaveBeenCalled();
  });

  it('공개 상태가 아닌 글(검토 중 등)은 기록하지 않는다', () => {
    state.user = { id: 'viewer' };
    state.post = post({ status: 'pending_review' });
    renderScreen();
    expect(state.recordPostView).not.toHaveBeenCalled();
  });
});

describe('PostDetailScreen — 분류·태그·채택 답변', () => {
  it('분류와 태그를 보여 준다', () => {
    renderScreen();
    expect(screen.getByText(/질문·Q&A/)).toBeInTheDocument();
    expect(screen.getByText('#바투동굴')).toBeInTheDocument();
  });

  it('질문 글 작성자만, 남의 댓글에 채택 버튼이 있다(자기 댓글엔 없음)', () => {
    state.user = { id: 'asker' };
    renderScreen();
    expect(screen.getAllByRole('button', { name: '채택' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: '채택' }));
    expect(state.setAccepted).toHaveBeenCalledWith('c1', expect.anything());
  });

  it('채택된 댓글에는 배지와 채택 취소가 있고, 취소하면 null로 보낸다', () => {
    state.user = { id: 'asker' };
    state.post = post({ accepted_comment_id: 'c1' });
    renderScreen();
    expect(screen.getByText('채택된 답변')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '채택 취소' }));
    expect(state.setAccepted).toHaveBeenCalledWith(null, expect.anything());
  });

  it('작성자가 아니거나 질문 글이 아니면 채택 버튼이 없다, 배지는 누구에게나 보인다', () => {
    state.user = { id: 'viewer' };
    state.post = post({ accepted_comment_id: 'c1' });
    renderScreen();
    expect(screen.queryByRole('button', { name: /채택/ })).not.toBeInTheDocument();
    expect(screen.getByText('채택된 답변')).toBeInTheDocument();
  });

  it('질문이 아닌 글에서는 작성자에게도 채택 버튼이 없다', () => {
    state.user = { id: 'asker' };
    state.post = post({ category: 'story' });
    renderScreen();
    expect(screen.queryByRole('button', { name: '채택' })).not.toBeInTheDocument();
  });
});

describe('PostDetailScreen — 공식 가이드 고정(관리자)', () => {
  it('관리자에게만 고정 버튼이 보이고, 누르면 고정을 켠다', () => {
    renderScreen();
    expect(screen.queryByRole('button', { name: /공식 가이드로 고정/ })).not.toBeInTheDocument();
    state.admin = true;
    state.user = { id: 'admin' };
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /도시 공식 가이드로 고정/ }));
    expect(state.setPinned).toHaveBeenCalledWith(true, expect.anything());
  });

  it('이미 고정된 글은 고정 해제로 바뀐다', () => {
    state.admin = true;
    state.user = { id: 'admin' };
    state.post = post({ pinned_at: '2026-10-03T00:00:00Z' });
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /고정 해제/ }));
    expect(state.setPinned).toHaveBeenCalledWith(false, expect.anything());
  });
});
