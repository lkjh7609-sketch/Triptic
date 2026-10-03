import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAdmin, setPostAcceptedComment, setPostPinned } from '../communityService';
import { postQueryKey } from './usePosts';

/** 보는 사람이 관리자인가(고정 버튼 노출용 — 실제 권한은 서버 함수가 다시 확인한다) */
export function useIsAdminViewer(userId: string | null) {
  return useQuery({
    queryKey: ['community', 'is-admin', userId ?? ''],
    queryFn: () => isAdmin(userId),
    enabled: !!userId,
    staleTime: 10 * 60 * 1000,
  });
}

function useInvalidateChannel(postId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: postQueryKey(postId) });
    queryClient.invalidateQueries({ queryKey: ['community', 'pinned'] });
    queryClient.invalidateQueries({ queryKey: ['community', 'channel-feed'] });
  };
}

export function useSetPostPinned(postId: string) {
  const invalidate = useInvalidateChannel(postId);
  return useMutation({
    mutationFn: (pinned: boolean) => setPostPinned(postId, pinned),
    onSuccess: invalidate,
  });
}

export function useSetAcceptedComment(postId: string) {
  const invalidate = useInvalidateChannel(postId);
  return useMutation({
    mutationFn: (commentId: string | null) => setPostAcceptedComment(postId, commentId),
    onSuccess: invalidate,
  });
}
