import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listPosts = vi.hoisted(() => vi.fn());
vi.mock('../communityService', () => ({
  getDestinationFollowerCount: vi.fn(),
  getDestinationGuide: vi.fn(),
  getPinnedPost: vi.fn(),
  listPopularTags: vi.fn(),
  listPosts,
}));
vi.mock('../companionService', () => ({
  listCompanionPosts: vi.fn(),
  listUrgentCompanionPosts: vi.fn(),
}));

import { useChannelPosts } from './useDestinationChannel';

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {children}
    </QueryClientProvider>
  );
}

beforeEach(() => {
  listPosts.mockReset();
  listPosts.mockResolvedValue({ posts: [], nextCursor: null });
});

describe('useChannelPosts', () => {
  it('분류·태그·검색·정렬을 조회에 싣고 고정 글은 목록에서 뺀다', async () => {
    const { result } = renderHook(
      () =>
        useChannelPosts({
          destinationId: 'd1',
          viewerId: null,
          search: '바투',
          sort: 'popular',
          category: 'qna',
          tag: '아침',
        }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listPosts).toHaveBeenCalledWith(
      expect.objectContaining({
        destinationId: 'd1',
        search: '바투',
        sort: 'popular',
        category: 'qna',
        tag: '아침',
        hidePinned: true,
        offset: 0,
      }),
    );
  });

  it('다음 쪽은 최신순이면 커서로, 인기·댓글순이면 위치로 이어 받는다', async () => {
    listPosts.mockResolvedValueOnce({ posts: [], nextCursor: { created_at: 't', id: 'x' } });
    const latest = renderHook(
      () => useChannelPosts({ destinationId: 'd1', viewerId: null, search: '', sort: 'latest' }),
      { wrapper },
    );
    await waitFor(() => expect(latest.result.current.hasNextPage).toBe(true));
    await latest.result.current.fetchNextPage();
    expect(listPosts).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: { created_at: 't', id: 'x' } }),
    );

    listPosts.mockResolvedValueOnce({ posts: [], nextCursor: null, nextOffset: 20 });
    const popular = renderHook(
      () => useChannelPosts({ destinationId: 'd2', viewerId: null, search: '', sort: 'popular' }),
      { wrapper },
    );
    await waitFor(() => expect(popular.result.current.hasNextPage).toBe(true));
    await popular.result.current.fetchNextPage();
    expect(listPosts).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: null, offset: 20 }),
    );
  });
});
