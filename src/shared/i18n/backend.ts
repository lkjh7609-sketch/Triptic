/**
 * i18next 커스텀 backend (07-i18n.md §2 "네임스페이스별 lazy load — 초기 번들에
 * 3개 언어 전부 넣지 않는다"). 별도 HTTP 서버나 i18next-http-backend 없이,
 * Vite의 `import.meta.glob`으로 `src/locales/**\/*.json`을 청크 단위 동적
 * import로 등록해두고, i18next가 언어/네임스페이스를 요청할 때만 그 청크를
 * 불러온다.
 */
import type { BackendModule, ReadCallback } from 'i18next';

const localeModules = import.meta.glob<{ default: Record<string, string> }>('../../locales/*/*.json');

export const ViteGlobBackend: BackendModule = {
  type: 'backend',
  init() {},
  read(language: string, namespace: string, callback: ReadCallback) {
    const key = `../../locales/${language}/${namespace}.json`;
    const loader = localeModules[key];
    if (!loader) {
      callback(new Error(`[i18n] missing locale resource: ${key}`), false);
      return;
    }
    loader()
      .then((mod) => callback(null, mod.default))
      .catch((err: unknown) => callback(err instanceof Error ? err : String(err), false));
  },
};
