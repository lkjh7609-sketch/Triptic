import { useAnnouncements } from './useAnnouncements';
import type { Announcement } from './noticeService';

/** 업데이트 공지가 아직 없을 때 설정 화면에 보이는 버전 */
export const FALLBACK_APP_VERSION = '1.0.2';

/**
 * 가장 최근에 게시한 '업데이트' 공지의 버전. 공지(notice) 종류는 버전을 적어도 보지 않고,
 * 버전이 비어 있는 업데이트도 건너뛴다. 없으면 null.
 */
export function latestUpdateVersion(list: Announcement[] | undefined): string | null {
  const updates = (list ?? []).filter((a) => a.kind === 'update' && a.published && a.version?.trim());
  if (updates.length === 0) return null;
  updates.sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at));
  return updates[0].version!.trim();
}

/** 설정 화면의 '버전' — 관리자가 업데이트 공지에 입력한 가장 최근 버전(없으면 기본값) */
export function useAppVersion(): string {
  const { data } = useAnnouncements();
  return latestUpdateVersion(data) ?? FALLBACK_APP_VERSION;
}
