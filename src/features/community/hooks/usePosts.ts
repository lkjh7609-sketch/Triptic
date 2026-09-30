import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import i18next from '@/shared/i18n';
import { tripService } from '@/shared/api/tripService';
import { tripsQueryKey } from '@/features/plan/hooks/useTrips';
import {
  addBookmark,
  createPost,
  deleteOwnPost,
  getPost,
  likePost,
  listBookmarkedPosts,
  listPopularPosts,
  listPosts,
  listUserPosts,
  removeBookmark,
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

/** 홈 "인기 여행기" — 최근 30일 좋아요 순 상위 글 */
export function usePopularPosts(opts: { limit?: number; viewerId?: string | null } = {}) {
  return useQuery({
    queryKey: ['community', 'popular', opts.limit ?? 4, opts.viewerId ?? ''],
    queryFn: () => listPopularPosts({ limit: opts.limit, viewerId: opts.viewerId }),
    staleTime: 5 * 60 * 1000,
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
      if (!userId) throw new Error(i18next.t('common:auth.loginRequired'));
      return liked ? unlikePost(postId, userId) : likePost(postId, userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: postQueryKey(postId) });
    },
  });
}

/** 글에 첨부된 일정 읽기 전용 조회(0036) */
export function usePostTrip(postId: string | undefined) {
  return useQuery({
    queryKey: ['community', 'post-trip', postId ?? ''],
    queryFn: () => tripService.getPostTrip(postId!),
    enabled: !!postId,
  });
}

/** 다른 사람의 공개 일정을 내 계정으로 복제 */
export function useForkPostTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, title, startDate }: { postId: string; title: string; startDate?: string | null }) =>
      tripService.forkPostTrip(postId, title, startDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tripsQueryKey });
    },
  });
}

export const bookmarkedPostsQueryKey = (userId: string | null) => ['community', 'bookmarked', userId ?? ''] as const;

/** 저장한 여행기 — 내 여행(계획) 탭의 "저장한 여행기" 구역 */
export function useBookmarkedPosts(userId: string | null) {
  return useQuery({
    queryKey: bookmarkedPostsQueryKey(userId),
    queryFn: () => listBookmarkedPosts(userId!),
    enabled: !!userId,
  });
}

/** 저장(북마크) 토글 — 끝나면 글 목록·단건·저장 목록을 다시 받는다(저장 수가 바로 바뀌게) */
export function useToggleBookmark(postId: string, userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bookmarked: boolean) => {
      if (!userId) throw new Error(i18next.t('common:auth.loginRequired'));
      return bookmarked ? removeBookmark(userId, postId) : addBookmark(userId, postId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community'] });
    },
  });
}
