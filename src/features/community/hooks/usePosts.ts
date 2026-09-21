import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createPost,
  deleteOwnPost,
  getPost,
  likePost,
  listPosts,
  listUserPosts,
  unlikePost,
  type PostCursor,
} from '../communityService';

export function feedQueryKey(opts: { tab: 'all' | 'following'; destinationId?: string; viewerId?: string | null }) {
  return ['community', 'feed', opts.tab, opts.destinationId ?? '', opts.viewerId ?? ''] as const;
}

/** 피드(전체/구독) — 06-community.md §6 커서 페이지네이션 */
export function usePostsFeed(opts: {
  tab: 'all' | 'following';
  destinationId?: string;
  viewerId?: string | null;
}) {
  return useInfiniteQuery({
    queryKey: feedQueryKey(opts),
    queryFn: ({ pageParam }: { pageParam: PostCursor | null }) =>
      listPosts({
        destinationId: opts.destinationId,
        followedByUserId: opts.tab === 'following' ? (opts.viewerId ?? undefined) : undefined,
        viewerId: opts.viewerId,
        cursor: pageParam,
      }),
    initialPageParam: null as PostCursor | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: opts.tab === 'all' || !!opts.viewerId,
  });
}

export function postQueryKey(postId: string) {
  return ['community', 'post', postId] as const;
}

export function usePost(postId: string | undefined, viewerId: string | null) {
  return useQuery({
    queryKey: postQueryKey(postId ?? ''),
    queryFn: () => getPost(postId!, viewerId),
    enabled: !!postId,
  });
}

export function useUserPosts(authorId: string | undefined, viewerId: string | null) {
  return useQuery({
    queryKey: ['community', 'user-posts', authorId ?? ''],
    queryFn: () => listUserPosts(authorId!, viewerId),
    enabled: !!authorId,
  });
}

export function useCreatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community', 'feed'] });
    },
  });
}

export function useDeletePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteOwnPost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community'] });
    },
  });
}

/** 좋아요 토글 — 낙관적 업데이트(단건 캐시만, 피드 목록은 다음 재조회 때 갱신) */
export function useToggleLike(postId: string, userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (liked: boolean) => {
      if (!userId) throw new Error('로그인이 필요합니다.');
      return liked ? unlikePost(postId, userId) : likePost(postId, userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: postQueryKey(postId) });
    },
  });
}
