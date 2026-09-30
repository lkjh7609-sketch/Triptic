import { useSyncExternalStore } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tripService, TripConflictError, type LocalProject, type TripRow } from '@/shared/api/tripService';
import { showToast } from '@/shared/ui/toast';
import { track } from '@/shared/monitoring';
import { SAMPLE_TRIP_ID, getSampleTripRow, updateSampleTripSnapshot } from '../sampleTrip';
import {
  createGuestTrip,
  deleteGuestTrip,
  getGuestTrip,
  isGuestTripId,
  listGuestTrips,
  renameGuestTrip,
  subscribeGuestTrips,
  updateGuestTripContent,
} from '../guestTrips';
import { isSignedIn } from '@/features/auth/loginPrompt';
import { useTranslation } from 'react-i18next';
import i18next from '@/shared/i18n';

export const tripsQueryKey = ['trips'] as const;

export function useTrips() {
  return useQuery<TripRow[]>({
    queryKey: tripsQueryKey,
    queryFn: () => tripService.listTrips(),
  });
}

/** 로그인 전에 이 기기에 만든 임시 여행 목록(guestTrips.ts) — 만들거나 고치면 바로 다시 그려진다 */
export function useGuestTrips(): TripRow[] {
  return useSyncExternalStore(subscribeGuestTrips, listGuestTrips, listGuestTrips);
}

/** 여행 목록 카드(완성도/장소/호텔/항공 칩)용 요약 — listTrips()와 갱신 타이밍을
 * 맞추려고 같은 쿼리 키 접두사 아래 별도 쿼리로 둔다(트립 CRUD는 tripsQueryKey를
 * invalidate하므로 이것도 같이 갱신된다). */
export function useTripSummaries(enabled = true) {
  return useQuery({
    queryKey: [...tripsQueryKey, 'summaries'],
    queryFn: () => tripService.listTripSummaries(),
    enabled,
  });
}

export function useCreateTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    // 로그인 전이면 이 기기에만 임시 여행으로 만든다(로그인하면 계정으로 옮겨진다 — guestTrips.ts)
    mutationFn: ({ project, name }: { project: LocalProject; name: string }) =>
      isSignedIn() ? tripService.saveTrip(project, name) : Promise.resolve(createGuestTrip(project, name)),
    onSuccess: (row) => {
      if (isGuestTripId(row.id)) return;
      track('trip_created', { source: 'create_modal' });
      queryClient.invalidateQueries({ queryKey: tripsQueryKey });
    },
  });
}

export function useDeleteTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tripId: string) => {
      if (isGuestTripId(tripId)) return deleteGuestTrip(tripId);
      return tripService.deleteTrip(tripId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tripsQueryKey });
    },
  });
}

/** 동행 인원이 바뀌었을 때 다시 셀 것들 — 여행 목록·카드 인원·홈 동행자 수 */
export function invalidateTripMembership(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: tripsQueryKey });
  queryClient.invalidateQueries({ queryKey: ['trip-members'] });
  queryClient.invalidateQueries({ queryKey: ['homeStats'] });
}

/** 함께하는 여행에서 나가기(소유자가 아닌 멤버) */
export function useLeaveTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tripId: string) => tripService.leaveTrip(tripId),
    onSuccess: (_data, tripId) => {
      queryClient.removeQueries({ queryKey: tripQueryKey(tripId) });
      invalidateTripMembership(queryClient);
    },
  });
}

/** 소유자가 멤버를 내보낸다 */
export function useRemoveTripMember(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => tripService.removeTripMember(tripId, userId),
    onSuccess: () => invalidateTripMembership(queryClient),
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
    queryFn: () => {
      if (tripId === SAMPLE_TRIP_ID) return getSampleTripRow();
      if (isGuestTripId(tripId)) return getGuestTrip(tripId!);
      return tripService.getTrip(tripId!);
    },
    enabled: !!tripId,
  });
}

/** 일정 완료(보기 전용 잠금) */
export function useFinalizeTrip(tripId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => tripService.finalizeTrip(tripId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tripQueryKey(tripId ?? '') });
      queryClient.invalidateQueries({ queryKey: tripsQueryKey });
    },
  });
}

/** 재편집(잠금 해제) — 무료 사용자는 여행당 5회까지 */
export function useReopenTrip(tripId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => tripService.reopenTrip(tripId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tripQueryKey(tripId ?? '') });
      queryClient.invalidateQueries({ queryKey: tripsQueryKey });
    },
  });
}

/** snapshot 부분 갱신 (장소 추가/삭제/순서변경 등). project는 이미 toLocalProject로 변환된 전체 상태
 * 비로그인 샘플 여행(SAMPLE_TRIP_ID)은 Supabase에 절대 쓰지 않고 메모리에만 반영한다
 * (index.html saveData의 `activeProjectName === SAMPLE_PROJECT_NAME` 조기 반환과 동일 — sampleTrip.ts 참고). */
/** 여행 저장 중인지 — 실시간 동기화가 저장 도중에 다시 읽어 방금 고친 내용을 덮지 않게 이 키로 확인한다 */
export function tripSaveMutationKey(tripId: string) {
  return ['trip-save', tripId] as const;
}

export function useUpdateTripSnapshot(tripId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: tripSaveMutationKey(tripId ?? ''),
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
      if (isGuestTripId(tripId)) {
        // 임시 여행 — 이 기기에만 저장한다. 제목은 여기서 안 바뀐다(이름 변경은 useRenameTrip)
        return Promise.resolve(
          updateGuestTripContent(tripId!, {
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
      if (isGuestTripId(row.id)) {
        queryClient.setQueryData(tripQueryKey(row.id), row);
        return;
      }
      if (row.id === SAMPLE_TRIP_ID) {
        // 샘플은 [..., 언어] 키라 접두사로 매칭해 갱신한다(Supabase·목록과 무관)
        queryClient.setQueriesData({ queryKey: tripQueryKey(row.id) }, row);
        return;
      }
      queryClient.setQueryData(tripQueryKey(row.id), row);
      queryClient.invalidateQueries({ queryKey: tripsQueryKey });
    },
    onError: (err) => {
      // 그 사이 이 여행이 먼저 바뀌었다(다른 동행자, 또는 내 연달은 저장) — 내 변경은 버리고 최신 일정을 다시 불러온다
      if (err instanceof TripConflictError) {
        showToast(i18next.t(err.byOther ? 'plan:collab.conflict' : 'plan:collab.conflictSelf'));
        queryClient.invalidateQueries({ queryKey: tripQueryKey(tripId ?? '') });
      }
    },
  });
}

/** 여행 이름 변경 (02-screens.md §3.1 "여행 복제 / 삭제 / 이름 변경") */
export function useRenameTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ tripId, newTitle }: { tripId: string; newTitle: string }) => {
      if (isGuestTripId(tripId)) return renameGuestTrip(tripId, newTitle);
      const trip = await tripService.getTrip(tripId);
      if (!trip) throw new Error('Trip not found');
      const project = tripService.toLocalProject(trip);
      return tripService.saveTrip({ ...project, supabaseId: tripId }, newTitle);
    },
    onSuccess: (row) => {
      queryClient.setQueryData(tripQueryKey(row.id), row);
      if (!isGuestTripId(row.id)) queryClient.invalidateQueries({ queryKey: tripsQueryKey });
    },
  });
}

/** 여행 복제 — snapshot을 그대로 복사해 새 여행으로 저장한다(원본은 그대로 둔다) */
export function useDuplicateTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tripId: string) => {
      if (isGuestTripId(tripId)) {
        showToast(i18next.t('common:guest.draftLocked'));
        throw new Error('guest_trip_duplicate');
      }
      const trip = await tripService.getTrip(tripId);
      if (!trip) throw new Error('Trip not found');
      const project = tripService.toLocalProject(trip);
      const { supabaseId: _omit, ...withoutId } = project;
      return tripService.saveTrip(withoutId, i18next.t('plan:tripCard.copyTitle', { title: trip.title }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tripsQueryKey });
    },
  });
}
