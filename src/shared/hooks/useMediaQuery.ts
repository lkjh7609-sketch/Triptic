import { useSyncExternalStore } from 'react';

/**
 * CSS 미디어 쿼리 구독. 첫 렌더부터 실제 값을 돌려준다 — 예전엔 초기값이 false라
 * 데스크톱에서도 모바일 화면이 먼저 마운트됐다가(쿼리 중복 요청·깜빡임) 교체됐다.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
