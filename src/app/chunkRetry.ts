const RELOAD_FLAG_KEY = 'triptic-chunk-reload';

export const CHUNK_LOAD_ERROR_PATTERN =
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

const GLOBAL_RELOAD_KEY = 'triptic-chunk-reload-at';
/** 전역 복구는 이 시간 안에 두 번 새로고침하지 않는다(청크가 정말로 깨져 있을 때 무한 새로고침 방지) */
export const GLOBAL_RELOAD_COOLDOWN_MS = 60_000;

export function shouldReloadForChunkError(reason: unknown, lastReloadAt: number | null, now = Date.now()): boolean {
  const message = reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : '';
  if (!CHUNK_LOAD_ERROR_PATTERN.test(message)) return false;
  return lastReloadAt === null || now - lastReloadAt > GLOBAL_RELOAD_COOLDOWN_MS;
}

/**
 * retryChunkLoad는 라우트 lazy import만 감싼다. 그 밖의 동적 import(번역 파일, PDF 내보내기, 모니터링 등)가
 * 새 배포 뒤 예전 탭에서 실패하면 처리되지 않은 Promise 거부로 남아 Sentry에 "Importing a module script failed"로
 * 쌓이고 화면은 그대로 멈춘다(9/30 모바일 Safari). 청크 로드 실패로 보이면 한 번(1분에 한 번까지) 새로고침해 최신 배포를 받는다.
 */
export function installStaleChunkReload(): void {
  const reloadOnce = (reason: unknown) => {
    let last: number | null = null;
    try {
      const raw = sessionStorage.getItem(GLOBAL_RELOAD_KEY);
      last = raw ? Number(raw) : null;
    } catch {
      return; // 기록을 못 남기면 무한 새로고침 위험 — 하지 않는다
    }
    if (!shouldReloadForChunkError(reason, Number.isFinite(last) ? last : null)) return;
    try {
      sessionStorage.setItem(GLOBAL_RELOAD_KEY, String(Date.now()));
    } catch {
      return;
    }
    window.location.reload();
  };
  window.addEventListener('unhandledrejection', (e) => reloadOnce(e.reason));
  // Vite가 자기 preload 도우미로 감싼 import가 실패할 때 내는 이벤트
  window.addEventListener('vite:preloadError', (e) => {
    e.preventDefault();
    reloadOnce((e as Event & { payload?: unknown }).payload);
  });
}
