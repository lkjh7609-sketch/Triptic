import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import i18next from '@/shared/i18n';
import {
  applyToCompanionPost,
  cancelCompanionPost,
  createCompanionPost,
  finalizeCompanionMatch,
  getCompanionPost,
  getMyCompanionQrToken,
  listApplicationsForPost,
  listCompanionMatchMembers,
  listCompanionPosts,
  listMyCompanionPosts,
  respondToApplication,
  verifyCompanionQrToken,
  withdrawApplication,
} from '../companionService';
import type { CompanionPost } from '../types';

export function companionFeedQueryKey(opts: { destinationId?: string; viewerId?: string | null }) {
  return ['community', 'companion', 'feed', opts.destinationId ?? '', opts.viewerId ?? ''] as const;
}

/** 동행찾기 목록(모집중) — posts 피드와 동일한 커서 페이지네이션 */
export function useCompanionPostsFeed(opts: { destinationId?: string; viewerId?: string | null }) {
  return useInfiniteQuery({
    queryKey: companionFeedQueryKey(opts),
    queryFn: ({ pageParam }) =>
      listCompanionPosts({ destinationId: opts.destinationId, viewerId: opts.viewerId, cursor: pageParam }),
    initialPageParam: null as { created_at: string; id: string } | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

export function companionPostQueryKey(postId: string) {
  return ['community', 'companion', 'post', postId] as const;
}

export function useCompanionPost(postId: string | undefined, viewerId: string | null) {
  return useQuery({
    queryKey: companionPostQueryKey(postId ?? ''),
    queryFn: () => getCompanionPost(postId!, viewerId),
    enabled: !!postId,
  });
}

export function useMyCompanionPosts(authorId: string | undefined) {
  return useQuery({
    queryKey: ['community', 'companion', 'my-posts', authorId ?? ''],
    queryFn: () => listMyCompanionPosts(authorId!),
    enabled: !!authorId,
  });
}

export function useCreateCompanionPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCompanionPost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community', 'companion'] });
    },
  });
}

export function useCancelCompanionPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cancelCompanionPost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community', 'companion'] });
    },
  });
}

export function useApplicationsForPost(postId: string | undefined) {
  return useQuery({
    queryKey: ['community', 'companion', 'applications', postId ?? ''],
    queryFn: () => listApplicationsForPost(postId!),
    enabled: !!postId,
  });
}

export function useApplyToCompanionPost(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (message?: string) => applyToCompanionPost({ postId, message }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companionPostQueryKey(postId) });
    },
  });
}

export function useRespondToApplication(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { applicationId: string; accept: boolean }) =>
      respondToApplication(input.applicationId, input.accept),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community', 'companion', 'applications', postId] });
      queryClient.invalidateQueries({ queryKey: companionPostQueryKey(postId) });
    },
  });
}

export function useWithdrawApplication(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: withdrawApplication,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companionPostQueryKey(postId) });
      queryClient.invalidateQueries({ queryKey: ['community', 'companion', 'match-members', postId] });
    },
  });
}

export function useFinalizeCompanionMatch(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => finalizeCompanionMatch(postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companionPostQueryKey(postId) });
      queryClient.invalidateQueries({ queryKey: ['community', 'companion', 'applications', postId] });
    },
  });
}

export function useCompanionMatchMembers(post: CompanionPost | null | undefined) {
  return useQuery({
    queryKey: ['community', 'companion', 'match-members', post?.id ?? ''],
    queryFn: () => listCompanionMatchMembers(post!),
    enabled: !!post && post.status === 'matched',
  });
}

export function useMyCompanionQrToken(postId: string | undefined) {
  return useQuery({
    queryKey: ['community', 'companion', 'qr-token', postId ?? ''],
    queryFn: () => getMyCompanionQrToken(postId!),
    enabled: !!postId,
  });
}

/** QR 스캔 결과 확인 — userId 없으면(로그인 안 됨) 즉시 에러 */
export function useVerifyCompanionQrToken(userId: string | null) {
  return useMutation({
    mutationFn: (token: string) => {
      if (!userId) throw new Error(i18next.t('common:auth.loginRequired'));
      return verifyCompanionQrToken(token);
    },
  });
}
