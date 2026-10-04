import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useSession } from '@/shared/hooks/useSession';
import { useTrips } from '@/features/plan/hooks/useTrips';
import {
  dismissNotification,
  markNotificationsRead,
  readNotificationState,
  subscribeNotifications,
} from './notificationStore';
import { useDestinationCoords, useTravelAlerts } from '@/features/travelAlerts/useTravelAlerts';
import { buildAlertNotices, type AlertNotice } from './alertNotices';
import { buildTripReminders, type TripReminder } from './tripReminders';
import {
  COMMUNITY_ID_PREFIX,
  deleteCommunityNotice,
  listCommunityNotices,
  markCommunityNoticesRead,
  type CommunityNotice,
} from './communityNotices';

export type TripNotification = ((TripReminder | AlertNotice) & { unread: boolean }) | CommunityNotice;

const communityKey = (userId: string | null) => ['notifications', 'community', userId ?? ''] as const;

const today = () => format(new Date(), 'yyyy-MM-dd');

/**
 * 종 모양 알림 — 내 글·댓글에 달린 댓글·답글·좋아요(서버가 만든 알림, 1분마다·창에 돌아올 때 다시 읽음),
 * 내 여행의 출발 7일 전·하루 전·당일, 목적지 나라의 여행경보(2단계 이상). 여행 알림은 푸시 없이 앱을 열었을 때만 계산한다.
 * 로그인하지 않았으면 비어 있다
 */
export function useTripNotifications() {
  const { user } = useSession();
  const userId = user?.id ?? null;
  const { data: trips } = useTrips();
  const { alerts } = useTravelAlerts();
  const { data: coords } = useDestinationCoords();
  // 앱을 켜 둔 채 날짜가 바뀌어도(자정) 돌아오면 다시 계산한다
  const [todayYmd, setTodayYmd] = useState(today);
  useEffect(() => {
    const refresh = () => setTodayYmd(today());
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  const queryClient = useQueryClient();
  const { data: community } = useQuery({
    queryKey: communityKey(userId),
    queryFn: listCommunityNotices,
    enabled: !!userId,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const markCommunityRead = useMutation({
    mutationFn: () => markCommunityNoticesRead(userId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: communityKey(userId) }),
  });
  const deleteCommunity = useMutation({
    mutationFn: (rowId: string) => deleteCommunityNotice(rowId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: communityKey(userId) }),
  });

  const state = useSyncExternalStore(
    subscribeNotifications,
    () => (userId ? readNotificationState(userId) : null),
    () => null,
  );

  const items = useMemo<TripNotification[]>(() => {
    if (!userId || !state) return [];
    // 경보가 더 급하니 먼저
    const all = [
      ...buildAlertNotices(trips ?? [], coords ?? [], alerts, todayYmd),
      ...buildTripReminders(trips ?? [], todayYmd),
    ];
    const local = all
      .filter((r) => !state.dismissed.includes(r.id))
      .map((r) => ({ ...r, unread: !state.read.includes(r.id) }));
    // 사람들이 남긴 반응이 가장 새로운 소식이라 맨 위에
    return [...(community ?? []), ...local];
  }, [userId, state, trips, coords, alerts, todayYmd, community]);

  return {
    signedIn: !!userId,
    items,
    unreadCount: items.filter((i) => i.unread).length,
    markAllRead: () => {
      if (!userId) return;
      markNotificationsRead(
        userId,
        items.filter((i) => i.kind !== 'community').map((i) => i.id),
      );
      if (items.some((i) => i.kind === 'community' && i.unread)) markCommunityRead.mutate();
    },
    dismiss: (id: string) => {
      if (!userId) return;
      if (id.startsWith(COMMUNITY_ID_PREFIX)) deleteCommunity.mutate(id.slice(COMMUNITY_ID_PREFIX.length));
      else dismissNotification(userId, id);
    },
  };
}
