/**
 * 홈(/) 첫 화면 데이터를 JS보다 먼저 요청해 두는 장치.
 *
 * 원래는 메인 JS → HomeScreen 청크가 실행된 뒤에야 데이터 요청이 시작돼(Lighthouse 2026-10-04: 2.4~3.0초 시점) 인천공항 전광판은
 * 5.3초, 항공 특가는 4.4초에 끝났다. 그래서 빌드가 index.html에 작은 인라인 스크립트를 넣어(vite.config.js `prefetch-home-data`)
 * 홈 주소일 때 HTML이 오자마자 요청을 시작하고, 그 약속(Promise)을 window.__prefetch[키]에 둔다. 화면 코드는 같은 요청을
 * 새로 보내기 전에 여기서 가져다 쓴다.
 *
 * - 키는 요청 주소 그대로라서(함수는 이름) 인라인 스크립트와 화면 코드의 요청이 어긋나면 그냥 안 쓰고 평소처럼 새로 받는다.
 * - 한 번만 쓴다(가져가면 지운다) — 3분마다 갱신 같은 다음 요청은 항상 새로 받는다.
 * - 실패(네트워크 오류·HTTP 오류)하면 null — 호출한 쪽이 평소처럼 새로 받는다.
 */
declare global {
  interface Window {
    __prefetch?: Record<string, Promise<unknown> | undefined>;
  }
}

export async function takePrefetch<T>(key: string): Promise<T | null> {
  const pending = typeof window === 'undefined' ? undefined : window.__prefetch?.[key];
  if (!pending) return null;
  delete window.__prefetch![key];
  try {
    return (await pending) as T;
  } catch {
    return null;
  }
}
