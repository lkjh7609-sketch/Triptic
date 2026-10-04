import { useQuery } from '@tanstack/react-query';
import { listAnnouncements } from './noticeService';

export const announcementsQueryKey = ['announcements'] as const;

/** 공개된 공지·업데이트 — 공지 페이지와 종 알림이 같이 쓴다 */
export function useAnnouncements(enabled = true) {
  return useQuery({
    queryKey: announcementsQueryKey,
    queryFn: listAnnouncements,
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}
