import { isLocalTripId } from '@/features/plan/guestTrips';

/**
 * 비로그인으로 둘러볼 때(PC·모바일 같음) 로그인 창을 먼저 띄우는 화면 — 커뮤니티 전체(게시판·글·동행,
 * 2026-10-05 회원 전용으로 바꿈), 통계, 설정, 내 여행 상세(샘플·임시 여행 제외). 나머지(홈·항공·호텔·액티비티·
 * 계획 목록·공지·사용 가이드)는 로그인 없이 볼 수 있다.
 */
export function requiresLogin(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/settings' || path.startsWith('/settings/')) return true;
  if (path === '/community' || path.startsWith('/community/')) return true;
  // 통계 — 내 여행을 모아 보는 화면이라 로그인이 필요하다(2026-10-09)
  if (path === '/stats' || path.startsWith('/stats/')) return true;
  // 내 여행 상세는 로그인이 필요하다. 샘플과 이 기기에 만든 임시 여행(guest-…)은 예외
  const trip = /^\/plan\/([^/]+)$/.exec(path);
  if (trip) return !isLocalTripId(trip[1]);
  return false;
}
