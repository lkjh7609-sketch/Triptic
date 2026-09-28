/** 홈 영역의 상단 탭 경로(홈 / 항공 / 호텔 / 액티비티) — 탭·하단 탭바·PC 헤더가 같이 쓴다 */
export const HOME_SECTIONS = [
  { to: '/', key: 'home' },
  { to: '/flights', key: 'flights' },
  { to: '/hotels', key: 'hotels' },
  { to: '/activities', key: 'activities' },
] as const;

export function isHomeSectionPath(pathname: string): boolean {
  return HOME_SECTIONS.some((s) => s.to === pathname);
}
