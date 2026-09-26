import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tripService, type LocalProject, type TripRow } from '@/shared/api/tripService';
import { SAMPLE_TRIP_ID, getSampleTripRow, updateSampleTripSnapshot } from '../sampleTrip';
import { useTranslation } from 'react-i18next';

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
  const { i18n } = useTranslation();
  return useQuery<TripRow | null>({
    // 샘플 여행은 표시 언어별로 내용이 달라서 언어를 키에 넣는다(tripQueryKey 접두사는 유지 —
    // removeQueries/setQueryData(tripQueryKey(...))가 그대로 매칭된다)
    queryKey: tripId === SAMPLE_TRIP_ID ? [...tripQueryKey(tripId), i18n.language] : tripQueryKey(tripId ?? ''),
    queryFn: () => (tripId === SAMPLE_TRIP_ID ? getSampleTripRow() : tripService.getTrip(tripId!)),
    enabled: !!tripId,
  });
}

/** snapshot 부분 갱신 (장소 추가/삭제/순서변경 등). project는 이미 toLocalProject로 변환된 전체 상태
 * 비로그인 샘플 여행(SAMPLE_TRIP_ID)은 Supabase에 절대 쓰지 않고 메모리에만 반영한다
 * (index.html saveData의 `activeProjectName === SAMPLE_PROJECT_NAME` 조기 반환과 동일 — sampleTrip.ts 참고). */
export function useUpdateTripSnapshot(tripId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ project, name }: { project: LocalProject; name: string }) => {
      if (tripId === SAMPLE_TRIP_ID) {
        return Promise.resolve(
          updateSampleTripSnapshot({
            data: project.data || {},
            hotels: project.hotels || {},
            meals: project.meals || {},
            expenses: project.expenses || {},
            flights: project.flights || { outbound: null, return: null },
            dayCities: project.dayCities || {},
          }),
        );
      }
      return tripService.saveTrip({ ...project, supabaseId: tripId }, name);
    },
    onSuccess: (row) => {
      if (row.id === SAMPLE_TRIP_ID) {
        // 샘플은 [..., 언어] 키라 접두사로 매칭해 갱신한다(Supabase·목록과 무관)
        queryClient.setQueriesData({ queryKey: tripQueryKey(row.id) }, row);
        return;
      }
      queryClient.setQueryData(tripQueryKey(row.id), row);
      queryClient.invalidateQueries({ queryKey: tripsQueryKey });
    },
  });
}

/** 여행 이름 변경 (02-screens.md §3.1 "여행 복제 / 삭제 / 이름 변경") */
export function useRenameTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ tripId, newTitle }: { tripId: string; newTitle: string }) => {
      const trip = await tripService.getTrip(tripId);
      if (!trip) throw new Error('Trip not found');
      const project = tripService.toLocalProject(trip);
      return tripService.saveTrip({ ...project, supabaseId: tripId }, newTitle);
    },
    onSuccess: (row) => {
      queryClient.setQueryData(tripQueryKey(row.id), row);
      queryClient.invalidateQueries({ queryKey: tripsQueryKey });
    },
  });
}

/** 여행 복제 — snapshot을 그대로 복사해 새 여행으로 저장한다(원본은 그대로 둔다) */
export function useDuplicateTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tripId: string) => {
      const trip = await tripService.getTrip(tripId);
      if (!trip) throw new Error('Trip not found');
      const project = tripService.toLocalProject(trip);
      const { supabaseId: _omit, ...withoutId } = project;
      return tripService.saveTrip(withoutId, `${trip.title} 사본`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tripsQueryKey });
    },
  });
}

/** 동행자 제안 목록 (index.html checkSuggestionsCount/openReviewSuggestionModal 이식)
 * 샘플 여행은 제안 기능을 지원하지 않는다(index.html openReviewSuggestionModal 가드와 동일) —
 * 실존하지 않는 tripId로 Supabase를 호출하지 않도록 여기서 막는다. */
export function useSuggestions(tripId: string | undefined) {
  return useQuery({
    queryKey: ['suggestions', tripId ?? ''],
    queryFn: () => tripService.listSuggestions(tripId!),
    enabled: !!tripId && tripId !== SAMPLE_TRIP_ID,
  });
}

/** 제안 거절 — 목록에서 제거만 한다 (index.html rejectSuggestion 이식) */
export function useRejectSuggestion(tripId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (suggestionId: string) => tripService.deleteSuggestion(suggestionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestions', tripId ?? ''] });
    },
  });
}
