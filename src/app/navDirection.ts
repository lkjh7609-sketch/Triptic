import type { NavigationType } from 'react-router';

/** 하단 탭/상단 헤더/홈 상단 탭(항공·호텔·액티비티)으로 오가는 최상위 화면 — 여기끼리는 페이드 */
const TAB_ROOTS = new Set(['/', '/plan', '/community', '/settings', '/flights', '/hotels', '/activities', '/airports']);

export type NavDirection = 'forward' | 'back' | 'fade';

function depth(pathname: string): number {
  return pathname.split('/').filter(Boolean).length;
}

function section(pathname: string): string {
  return pathname.split('/').filter(Boolean)[0] ?? '';
}

/**
 * 화면 전환 애니메이션 방향(global.css의 html[data-nav]).
 * - 탭 → 탭, 또는 다른 섹션의 탭 화면으로 점프: 페이드
 * - 더 깊이 들어가기: forward(오른쪽에서 밀려 들어옴)
 * - 뒤로가기/상위로 빠져나오기: back
 */
export function navDirection(prev: string, next: string, navType: `${NavigationType}`): NavDirection {
  if (TAB_ROOTS.has(next) && (TAB_ROOTS.has(prev) || section(prev) !== section(next))) return 'fade';
  const diff = depth(next) - depth(prev);
  if (navType === 'POP') return diff > 0 ? 'forward' : 'back';
  if (diff < 0) return 'back';
  if (diff === 0 && navType === 'REPLACE') return 'fade';
  return 'forward';
}
