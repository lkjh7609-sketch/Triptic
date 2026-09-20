import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tripService, type LocalProject, type TripRow } from '@/shared/api/tripService';

export const tripsQueryKey = ['trips'] as const;

export function useTrips() {
  return useQuery<TripRow[]>({
    queryKey: tripsQueryKey,
    queryFn: () => tripService.listTrips(),
  });
}

export function useCreateTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ project, name }: { project: LocalProject; name: string }) =>
      tripService.saveTrip(project, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tripsQueryKey });
    },
  });
}

export function useDeleteTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tripId: string) => tripService.deleteTrip(tripId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tripsQueryKey });
    },
  });
}

export function tripQueryKey(tripId: string) {
  return ['trip', tripId] as const;
}

export function useTrip(tripId: string | undefined) {
  return useQuery<TripRow | null>({
    queryKey: tripQueryKey(tripId ?? ''),
    queryFn: () => tripService.getTrip(tripId!),
    enabled: !!tripId,
  });
}

/** snapshot 부분 갱신 (장소 추가/삭제/순서변경 등). project는 이미 toLocalProject로 변환된 전체 상태 */
export function useUpdateTripSnapshot(tripId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ project, name }: { project: LocalProject; name: string }) =>
      tripService.saveTrip({ ...project, supabaseId: tripId }, name),
    onSuccess: (row) => {
      queryClient.setQueryData(tripQueryKey(row.id), row);
      queryClient.invalidateQueries({ queryKey: tripsQueryKey });
    },
  });
}
