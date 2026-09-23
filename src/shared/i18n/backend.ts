/**
 * i18next 커스텀 backend (07-i18n.md §2 "네임스페이스별 lazy load — 초기 번들에
 * 3개 언어 전부 넣지 않는다"). 별도 HTTP 서버나 i18next-http-backend 없이,
 * Vite의 청크 단위 동적 import로 등록해두고, i18next가 언어/네임스페이스를 요청할 때만
 * 그 청크를 불러온다.
 */
import type { BackendModule, ReadCallback } from 'i18next';

const localeModules: Record<string, () => Promise<any>> = {
  'en/common': () => import('../../locales/en/common.json'),
  'en/community': () => import('../../locales/en/community.json'),
  'en/documents': () => import('../../locales/en/documents.json'),
  'en/home': () => import('../../locales/en/home.json'),
  'en/plan': () => import('../../locales/en/plan.json'),
  'en/settings': () => import('../../locales/en/settings.json'),
  'en/weather': () => import('../../locales/en/weather.json'),
  'ko/common': () => import('../../locales/ko/common.json'),
  'ko/community': () => import('../../locales/ko/community.json'),
  'ko/documents': () => import('../../locales/ko/documents.json'),
  'ko/home': () => import('../../locales/ko/home.json'),
  'ko/plan': () => import('../../locales/ko/plan.json'),
  'ko/settings': () => import('../../locales/ko/settings.json'),
  'ko/weather': () => import('../../locales/ko/weather.json'),
  'zh-CN/common': () => import('../../locales/zh-CN/common.json'),
  'zh-CN/community': () => import('../../locales/zh-CN/community.json'),
  'zh-CN/documents': () => import('../../locales/zh-CN/documents.json'),
  'zh-CN/home': () => import('../../locales/zh-CN/home.json'),
  'zh-CN/plan': () => import('../../locales/zh-CN/plan.json'),
  'zh-CN/settings': () => import('../../locales/zh-CN/settings.json'),
  'zh-CN/weather': () => import('../../locales/zh-CN/weather.json'),
};

export const ViteGlobBackend: BackendModule = {
  type: 'backend',
  init() {},
  read(language: string, namespace: string, callback: ReadCallback) {
    const key = `${language}/${namespace}`;
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
