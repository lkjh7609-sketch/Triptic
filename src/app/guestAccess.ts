import { SAMPLE_TRIP_ID } from '@/features/plan/sampleTrip';

/**
 * PC에서 비로그인으로 둘러볼 때 로그인 창을 먼저 띄우는 화면 — 글쓰기·동행 모집/채팅/정산,
 * 설정, 내 여행 상세(샘플 여행 제외). 나머지(홈·항공·호텔·액티비티·계획 목록·커뮤니티 읽기)는
 * 로그인 없이 볼 수 있다. 모바일은 앱 전체가 로그인 화면으로 막힌다(AppShell).
 */
export function requiresLogin(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/settings' || path.startsWith('/settings/')) return true;
  if (path === '/community/compose' || path === '/community/companion/new') return true;
  if (/^\/community\/companion\/[^/]+\/(match|chat|expenses)$/.test(path)) return true;
  if (/^\/plan\/[^/]+$/.test(path)) return path !== `/plan/${SAMPLE_TRIP_ID}`;
  return false;
}
