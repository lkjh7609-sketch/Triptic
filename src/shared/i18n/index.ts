/**
 * i18next 초기화 (07-i18n.md §1, §2)
 * 지원 로케일: ko(소스) / en / zh-TW(대만 번체) / ja. 폴백은 전부 ko(원본 언어).
 * 브라우저가 zh-CN·zh-HK·zh처럼 다른 중국어 태그를 주면 zh-TW로, en-US·ja-JP처럼
 * 지역이 붙은 태그는 언어 부분으로 맞춘다(normalizeLocale).
 * 감지 순서: localStorage(§2.2) > navigator.language > 'ko'. 로그인 사용자의
 * `profiles.locale`은 비동기로만 얻을 수 있어 부팅 감지에는 못 쓴다 —
 * `useSyncLocale`(같은 디렉터리)이 로그인 후 프로필 값으로 한 번 더 맞춘다.
 *
 * ⚠️ i18next-icu는 의도적으로 안 쓴다 — ICU MessageFormat 파서/CLDR 데이터가
 * 무거워(gzip ~90KB) 초기 번들 예산(DEVELOPMENT_PLAN.md §10.1, ≤250KB gzip)을
 * 크게 넘겼다. §7의 "성별/선택" 요구는 없고 "플러럴"만 필요한데, 이건
 * i18next 내장 plural(키 접미사 `_one`/`_other`, Intl.PluralRules 기반)로
 * 스펙 §2.2 예시 그대로 충족된다.
 */
import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import { ViteGlobBackend } from './backend';
import { loadLocaleFont } from './fonts';
import { PSEUDO_POST_PROCESSOR_NAME, isPseudoLocaleEnabled, pseudoPostProcessor } from './pseudoLocale';

export const SUPPORTED_LOCALES = ['ko', 'en', 'zh-TW', 'ja'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/** 임의의 언어 태그 → 지원 로케일 4종 중 하나(모르면 ko) */
export function normalizeLocale(tag: string | null | undefined): SupportedLocale {
  if (!tag) return 'ko';
  if ((SUPPORTED_LOCALES as readonly string[]).includes(tag)) return tag as SupportedLocale;
  const lower = tag.toLowerCase();
  if (lower.startsWith('zh')) return 'zh-TW';
  const base = lower.split(/[-_]/)[0];
  return (SUPPORTED_LOCALES as readonly string[]).includes(base) ? (base as SupportedLocale) : 'ko';
}

export const NAMESPACES = [
  'common',
  'home',
  'plan',
  'documents',
  'community',
  'settings',
  'weather',
] as const;

export const LOCALE_STORAGE_KEY = 'triptic-locale';

const pseudoEnabled = isPseudoLocaleEnabled();

const instance = i18next.use(ViteGlobBackend).use(LanguageDetector).use(initReactI18next);
if (pseudoEnabled) instance.use(pseudoPostProcessor);

void instance.init({
  supportedLngs: SUPPORTED_LOCALES,
  load: 'currentOnly',
  fallbackLng: 'ko',
  ns: NAMESPACES,
  defaultNS: 'common',
  interpolation: { escapeValue: false }, // React가 이미 이스케이프함
  detection: {
    order: ['localStorage', 'navigator'],
    caches: ['localStorage'],
    lookupLocalStorage: LOCALE_STORAGE_KEY,
    convertDetectedLanguage: (lng: string) => normalizeLocale(lng),
  },
  react: { useSuspense: true },
  postProcess: pseudoEnabled ? [PSEUDO_POST_PROCESSOR_NAME] : undefined,
});

/** <html lang>은 스크린리더 발음에도 영향을 준다(07-i18n.md §3.2) — 항상 최신 로케일로 유지한다. */
function syncDocumentLocale(locale: string) {
  document.documentElement.lang = locale;
  loadLocaleFont(locale);
}

i18next.on('languageChanged', syncDocumentLocale);
if (i18next.language) syncDocumentLocale(i18next.language);

export default i18next;
