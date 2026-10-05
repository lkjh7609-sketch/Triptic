/** react-router ScrollRestoration이 화면 위치를 적어 두는 sessionStorage 키 */
export const SCROLL_STORAGE_KEY = 'react-router-scroll-positions';

/**
 * 주소를 열거나 새로고침(탭이 메모리에서 내려갔다 다시 뜨는 경우 포함)하면 항상 맨 위에서 시작한다.
 * 저장된 위치는 같은 기록 항목으로 돌아올 때(뒤로·앞으로 가기)만 쓰이게, 그 외의 로드에서는 지운다 —
 * 안 지우면 새로고침·재접속 때 ScrollRestoration이 예전 스크롤(페이지 중간)로 올려 버린다.
 */
export function startAtTop(): void {
  try {
    const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (entry?.type === 'back_forward') return;
    sessionStorage.removeItem(SCROLL_STORAGE_KEY);
    window.scrollTo(0, 0);
  } catch {
    // 저장소를 못 쓰는 환경(사생활 보호 모드 등) — 기본 동작에 맡긴다
  }
}
