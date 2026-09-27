const RELOAD_FLAG_KEY = 'triptic-chunk-reload';

const CHUNK_LOAD_ERROR_PATTERN =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|is not a valid JavaScript MIME type|Importing a module script failed/i;

/**
 * 매 배포마다 청크 파일명이 바뀐다 — 새 배포 이후에도 열려 있던 탭이 예전
 * index.html/청크 경로로 lazy import()하면, 호스팅이 그 경로를 SPA
 * index.html(text/html, 200)로 대체 응답해서 "'text/html' is not a valid
 * JavaScript MIME type" 에러로 라우트가 통째로 죽는다. 청크 로드 실패로
 * 보이면 한 번만 전체 새로고침해서 최신 배포를 다시 받는다(무한 새로고침
 * 방지용 sessionStorage 플래그 — 새로고침해도 안 되면 그냥 에러를 던진다).
 */
export async function retryChunkLoad<T>(loader: () => Promise<T>): Promise<T> {
  try {
    const result = await loader();
    // 로드에 성공하면 플래그를 지운다 — 한 탭 세션 안에서 나중에 또 새 배포가
    // 나가도(드문 경우) 그때 다시 한 번 자동 새로고침으로 복구할 수 있게.
    sessionStorage.removeItem(RELOAD_FLAG_KEY);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (CHUNK_LOAD_ERROR_PATTERN.test(message) && !sessionStorage.getItem(RELOAD_FLAG_KEY)) {
      sessionStorage.setItem(RELOAD_FLAG_KEY, '1');
      window.location.reload();
      // 새로고침이 실제로 일어날 때까지 라우터가 빈 화면 이상을 시도하지 않도록 대기만 한다.
      return new Promise<T>(() => {});
    }
    throw err;
  }
}
