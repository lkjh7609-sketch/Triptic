import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/api/supabaseClient';
import type { TripRow } from '@/shared/api/tripService';
import { invalidateTripMembership, tripQueryKey, tripSaveMutationKey, tripsQueryKey } from './useTrips';

/**
 * 여행 실시간 동기화(0058) — 로그인한 동안 채널 하나로 받는다. 무엇이 오는지는 RLS가
 * 정한다(내가 소유자이거나 멤버인 여행만).
 * - trips 행 변경: 목록을 다시 읽고, 받아 둔 여행이 더 새 버전(revision)이면 일정도 다시 읽는다.
 *   저장 한 번에 신호가 두 번 온다(행 수정 → 일정 교체 후 "저장 끝") — 모아서 한 번에 처리한다.
 *   내가 저장한 것은 이미 그 버전을 들고 있어 다시 읽지 않는다.
 * - trip_members 변경: 여행 카드 인원·함께하는 사람·홈 동행자 수를 다시 센다.
 */
export function useTripRealtimeSync(userId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;
    const supabase = getSupabaseClient();
    const latestRevision = new Map<string, number>();
    const tripTimers = new Map<string, number>();
    let listTimer: number | undefined;
    let membersTimer: number | undefined;

    const refreshList = () => {
      window.clearTimeout(listTimer);
      listTimer = window.setTimeout(() => queryClient.invalidateQueries({ queryKey: tripsQueryKey }), 800);
    };

    const syncTrip = (tripId: string) => {
      window.clearTimeout(tripTimers.get(tripId));
      tripTimers.set(
        tripId,
        window.setTimeout(() => {
          // 내가 이 여행을 저장하는 중이면 끝난 뒤에 본다 — 도중에 다시 읽으면 방금 고친 게 사라져 보인다
          if (queryClient.isMutating({ mutationKey: tripSaveMutationKey(tripId) }) > 0) {
            syncTrip(tripId);
            return;
          }
          const latest = latestRevision.get(tripId) ?? 0;
          latestRevision.delete(tripId);
          const cached = queryClient.getQueryData<TripRow | null>(tripQueryKey(tripId));
          if (cached && (cached.revision ?? 0) >= latest) return;
          queryClient.invalidateQueries({ queryKey: tripQueryKey(tripId), exact: true });
        }, 400),
      );
    };

    const channel = supabase
      .channel(`trip-sync:${userId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trips' }, (payload) => {
        const row = payload.new as Partial<TripRow>;
        if (!row.id) return;
        refreshList();
        latestRevision.set(row.id, Math.max(latestRevision.get(row.id) ?? 0, row.revision ?? 0));
        syncTrip(row.id);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'trips' }, refreshList)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_members' }, () => {
        window.clearTimeout(membersTimer);
        membersTimer = window.setTimeout(() => invalidateTripMembership(queryClient), 300);
      })
      .subscribe();

    return () => {
      window.clearTimeout(listTimer);
      window.clearTimeout(membersTimer);
      tripTimers.forEach((id) => window.clearTimeout(id));
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}
