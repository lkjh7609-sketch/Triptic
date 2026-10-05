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
  adjacent: undefined as unknown,
  likeComment: vi.fn(),
  recordPostView: vi.fn(),
  setPinned: vi.fn(),
  setAccepted: vi.fn(),
  deletePost: vi.fn(),
}));

vi.mock('@/shared/hooks/useSession', () => ({ useSession: () => ({ user: state.user }) }));
vi.mock('@/shared/hooks/useProfile', () => ({ useProfile: () => ({ data: { locale: 'ko' } }) }));
vi.mock('./hooks/usePosts', () => ({
  usePost: () => ({ data: state.post, isLoading: false, isError: false, refetch: vi.fn() }),
  useDeletePost: () => ({ mutateAsync: state.deletePost }),
  useToggleLike: () => ({ mutate: vi.fn() }),
  useAdjacentPosts: () => ({ data: state.adjacent }),
  usePostTrip: () => ({ data: undefined }),
}));
vi.mock('./hooks/useDestinations', () => ({
  useDestinations: () => ({ data: [{ id: 'd1', slug: 'batu', name: '바투' }] }),
}));
vi.mock('./hooks/useComments', () => ({
  useComments: () => ({ data: state.comments }),
  useCreateComment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteComment: () => ({ mutate: vi.fn() }),
  useToggleCommentLike: () => ({ mutate: state.likeComment }),
}));
vi.mock('./hooks/usePostMeta', () => ({
  useIsAdminViewer: () => ({ data: state.admin }),
  useSetPostPinned: () => ({ mutate: state.setPinned, isPending: false }),
  useSetAcceptedComment: () => ({ mutate: state.setAccepted, isPending: false }),
}));
vi.mock('./communityService', () => ({ recordPostView: (id: string) => state.recordPostView(id) }));
vi.mock('./BookmarkButton', () => ({ BookmarkButton: () => null }));
// ⋮ 메뉴는 어떤 항목이 넘어왔는지만 본다(메뉴 자체는 PostActionsMenu.test.tsx)
vi.mock('./PostActionsMenu', () => ({
  PostActionsMenu: ({ targetType, onEdit, onDelete, onTogglePin, pinned }: { targetType: string; onEdit?: () => void; onDelete?: () => void; onTogglePin?: () => void; pinned?: boolean }) =>
    targetType === 'post' ? (
      <div>
        {onEdit ? <button onClick={onEdit}>메뉴:수정</button> : null}
        {onDelete ? <button onClick={onDelete}>메뉴:삭제</button> : null}
        {onTogglePin ? <button onClick={onTogglePin}>{pinned ? '메뉴:고정 해제' : '메뉴:고정'}</button> : null}
      </div>
    ) : null,
}));
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
    title: '바투동굴 질문',
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
          <Route path="/community/d/:slug" element={<p>도시 게시판 화면</p>} />
          <Route path="/community/board" element={<p>자유게시판 화면</p>} />
          <Route path="/community" element={<p>커뮤니티 메인 화면</p>} />
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
  state.adjacent = undefined;
  state.likeComment.mockClear();
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

describe('PostDetailScreen — ⋮ 메뉴(수정·삭제·관리자 고정)', () => {
  it('본인 글이면 수정·삭제가 메뉴에 있고, 남의 글이면 없다', () => {
    state.user = { id: 'asker' };
    const { unmount } = renderScreen();
    expect(screen.getByRole('button', { name: '메뉴:수정' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '메뉴:삭제' })).toBeInTheDocument();
    unmount();
    state.user = { id: 'viewer' };
    renderScreen();
    expect(screen.queryByRole('button', { name: '메뉴:수정' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '메뉴:삭제' })).not.toBeInTheDocument();
  });

  it('글을 지우면 그 글이 있던 도시 게시판으로 이동한다(지운 글 주소로 돌아오지 않는다)', async () => {
    state.user = { id: 'asker' };
    state.deletePost.mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: '메뉴:삭제' }));
    expect(await screen.findByText('도시 게시판 화면')).toBeInTheDocument();
    expect(state.deletePost).toHaveBeenCalledWith('p1');
  });

  it('도시 없는 글(자유게시판)을 지우면 자유게시판으로 이동한다', async () => {
    state.user = { id: 'asker' };
    state.post = post({ destination_id: null });
    state.deletePost.mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: '메뉴:삭제' }));
    expect(await screen.findByText('자유게시판 화면')).toBeInTheDocument();
  });

  it('고정은 관리자에게만 메뉴로 나오고(본문 아래 버튼은 없다), 누르면 고정을 켠다', () => {
    const { unmount } = renderScreen();
    expect(screen.queryByRole('button', { name: /고정/ })).not.toBeInTheDocument();
    unmount();
    state.admin = true;
    state.user = { id: 'admin' };
    renderScreen();
    expect(screen.queryByRole('button', { name: /도시 공식 가이드로 고정/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '메뉴:고정' }));
    expect(state.setPinned).toHaveBeenCalledWith(true, expect.anything());
  });

  it('이미 고정된 글은 고정 해제로 바뀌고, 고정 표시 칩이 보인다', () => {
    state.admin = true;
    state.user = { id: 'admin' };
    state.post = post({ pinned_at: '2026-10-03T00:00:00Z' });
    renderScreen();
    expect(screen.getByText('도시 공식 가이드로 고정')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '메뉴:고정 해제' }));
    expect(state.setPinned).toHaveBeenCalledWith(false, expect.anything());
  });

  it('고정할 도시가 없는 글은 관리자에게도 고정 메뉴가 없다', () => {
    state.admin = true;
    state.user = { id: 'admin' };
    state.post = post({ destination_id: null });
    renderScreen();
    expect(screen.queryByRole('button', { name: /메뉴:고정/ })).not.toBeInTheDocument();
  });
});

describe('PostDetailScreen — 제목·본문·댓글·이전/다음', () => {
  it('제목을 크게 보여 주고 본문은 그 아래에 있다', () => {
    renderScreen();
    expect(screen.getByRole('heading', { level: 1, name: '바투동굴 질문' })).toBeInTheDocument();
    expect(screen.getByText('질문 본문')).toBeInTheDocument();
  });

  it('제목이 없는 옛 글은 본문 첫 줄을 제목으로 보여 준다', () => {
    state.post = post({ title: null, body: '첫 줄 제목\n둘째 줄' });
    renderScreen();
    expect(screen.getByRole('heading', { level: 1, name: '첫 줄 제목' })).toBeInTheDocument();
  });

  it('글쓴이가 쓴 댓글에는 작성자 배지가 붙고, 답글은 묶음 아래에 들어간다', () => {
    state.comments = [
      { ...comment('c1', 'helper') },
      { ...comment('c2', 'asker'), parent_id: 'c1' },
    ];
    renderScreen();
    // 글 머리 작성자 배지 1 + 댓글 작성자 배지 1
    expect(screen.getAllByText('작성자')).toHaveLength(2);
    expect(screen.getByText('댓글 c2')).toBeInTheDocument();
  });

  it('댓글 좋아요: 비로그인은 로그인 창, 로그인하면 토글한다', () => {
    state.user = { id: 'viewer' };
    state.comments = [{ ...comment('c1', 'helper'), like_count: 3, likedByMe: false }];
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /좋아요 3/ }));
    expect(state.likeComment).toHaveBeenCalledWith({ commentId: 'c1', liked: false });
  });

  it('이전·다음 글은 제목으로 보여 준다', () => {
    state.adjacent = { prev: { id: 'p0', title: '이전 글 제목', body: '' }, next: { id: 'p2', title: null, body: '다음 본문 첫 줄' } };
    renderScreen();
    expect(screen.getByRole('link', { name: /이전 글 제목/ })).toHaveAttribute('href', '/community/post/p0');
    expect(screen.getByRole('link', { name: /다음 본문 첫 줄/ })).toHaveAttribute('href', '/community/post/p2');
  });
});
