import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { format } from 'date-fns';
import { useSession } from '@/shared/hooks/useSession';
import { useTrips } from '@/features/plan/hooks/useTrips';
import {
  dismissNotification,
  markNotificationsRead,
  readNotificationState,
  subscribeNotifications,
} from './notificationStore';
import { buildTripReminders, type TripReminder } from './tripReminders';

export interface TripNotification extends TripReminder {
  unread: boolean;
}

const today = () => format(new Date(), 'yyyy-MM-dd');

/** 종 모양 알림 — 내 여행의 출발 7일 전·하루 전·당일. 푸시 없이 앱을 열었을 때만 계산해 보여 준다. 로그인하지 않았으면 비어 있다 */
export function useTripNotifications() {
  const { user } = useSession();
  const userId = user?.id ?? null;
  const { data: trips } = useTrips();
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

  const state = useSyncExternalStore(
    subscribeNotifications,
    () => (userId ? readNotificationState(userId) : null),
    () => null,
  );

  const items = useMemo<TripNotification[]>(() => {
    if (!userId || !state) return [];
    return buildTripReminders(trips ?? [], todayYmd)
      .filter((r) => !state.dismissed.includes(r.id))
      .map((r) => ({ ...r, unread: !state.read.includes(r.id) }));
  }, [userId, state, trips, todayYmd]);

  return {
    signedIn: !!userId,
    items,
    unreadCount: items.filter((i) => i.unread).length,
    markAllRead: () =>
      userId &&
      markNotificationsRead(
        userId,
        items.map((i) => i.id),
      ),
    dismiss: (id: string) => userId && dismissNotification(userId, id),
  };
}
