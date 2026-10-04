import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createComment, deleteOwnComment, likeComment, listComments, unlikeComment } from '../communityService';
import { postQueryKey } from './usePosts';

export function commentsQueryKey(postId: string) {
  return ['community', 'comments', postId] as const;
}

export function useComments(postId: string | undefined, viewerId: string | null = null) {
  return useQuery({
    queryKey: [...commentsQueryKey(postId ?? ''), viewerId ?? ''],
    queryFn: () => listComments(postId!, viewerId),
    enabled: !!postId,
  });
}

/** 댓글 좋아요 토글 — 끝나면 댓글 목록을 다시 읽는다 */
export function useToggleCommentLike(postId: string, userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, liked }: { commentId: string; liked: boolean }) => {
      if (!userId) throw new Error('login required');
      return liked ? unlikeComment(commentId, userId) : likeComment(commentId, userId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: commentsQueryKey(postId) }),
  });
}

export function useCreateComment(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { body: string; parentId?: string | null }) =>
      createComment({ postId, body: input.body, parentId: input.parentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentsQueryKey(postId) });
      queryClient.invalidateQueries({ queryKey: postQueryKey(postId) });
    },
  });
}

export function useDeleteComment(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteOwnComment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentsQueryKey(postId) });
      queryClient.invalidateQueries({ queryKey: postQueryKey(postId) });
    },
  });
}
