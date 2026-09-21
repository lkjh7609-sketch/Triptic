import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMyProfile, updateMyProfile, type ProfilePatch, type ProfileRow } from '@/shared/api/profileService';
import { useSession } from './useSession';

export function profileQueryKey(userId: string) {
  return ['profile', userId] as const;
}

export function useProfile() {
  const { user } = useSession();
  return useQuery<ProfileRow>({
    queryKey: profileQueryKey(user?.id ?? ''),
    queryFn: () => getMyProfile(user!.id),
    enabled: !!user,
  });
}

export function useUpdateProfile() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: ProfilePatch) => {
      if (!user) throw new Error('로그인이 필요합니다.');
      return updateMyProfile(user.id, patch);
    },
    onSuccess: (_data, patch) => {
      if (!user) return;
      queryClient.setQueryData<ProfileRow | undefined>(profileQueryKey(user.id), (prev) =>
        prev ? { ...prev, ...patch } : prev,
      );
    },
  });
}
