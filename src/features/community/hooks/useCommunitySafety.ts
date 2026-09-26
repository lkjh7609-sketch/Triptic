import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import i18next from '@/shared/i18n';
import {
  blockUser,
  followDestination,
  listMyBlocks,
  listMyFollowedDestinationIds,
  reportContent,
  unblockUser,
  unfollowDestination,
} from '../communityService';
import type { ReportReason, ReportTargetType } from '../types';

interface ReportInput {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  detail?: string;
}

export function followedDestinationIdsQueryKey(userId: string) {
  return ['community', 'follows', userId] as const;
}

export function useFollowedDestinationIds(userId: string | null) {
  return useQuery({
    queryKey: followedDestinationIdsQueryKey(userId ?? ''),
    queryFn: () => listMyFollowedDestinationIds(userId!),
    enabled: !!userId,
  });
}

export function useToggleFollow(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ destinationId, following }: { destinationId: string; following: boolean }) => {
      if (!userId) throw new Error(i18next.t('common:auth.loginRequired'));
      return following ? unfollowDestination(destinationId, userId) : followDestination(destinationId, userId);
    },
    onSuccess: () => {
      if (userId) queryClient.invalidateQueries({ queryKey: followedDestinationIdsQueryKey(userId) });
    },
  });
}

export const myBlocksQueryKey = (userId: string) => ['community', 'blocks', userId] as const;

export function useMyBlocks(userId: string | null) {
  return useQuery({
    queryKey: myBlocksQueryKey(userId ?? ''),
    queryFn: () => listMyBlocks(userId!),
    enabled: !!userId,
  });
}

export function useBlockUser(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (blockedId: string) => {
      if (!userId) throw new Error(i18next.t('common:auth.loginRequired'));
      return blockUser(blockedId, userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community'] });
    },
  });
}

export function useUnblockUser(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (blockedId: string) => {
      if (!userId) throw new Error(i18next.t('common:auth.loginRequired'));
      return unblockUser(blockedId, userId);
    },
    onSuccess: () => {
      if (userId) queryClient.invalidateQueries({ queryKey: myBlocksQueryKey(userId) });
    },
  });
}

export function useReportContent(userId: string | null) {
  return useMutation({
    mutationFn: (input: ReportInput) => {
      if (!userId) throw new Error(i18next.t('common:auth.loginRequired'));
      return reportContent({ ...input, userId });
    },
  });
}
