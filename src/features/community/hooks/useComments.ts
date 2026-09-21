import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createComment, deleteOwnComment, listComments } from '../communityService';
import { postQueryKey } from './usePosts';

export function commentsQueryKey(postId: string) {
  return ['community', 'comments', postId] as const;
}

export function useComments(postId: string | undefined) {
  return useQuery({
    queryKey: commentsQueryKey(postId ?? ''),
    queryFn: () => listComments(postId!),
    enabled: !!postId,
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
