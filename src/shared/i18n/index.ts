/**
 * i18next 초기화 (07-i18n.md §1, §2)
 * 지원 로케일: ko(소스) / en / zh-TW(대만 번체) / ja. 폴백은 전부 ko(원본 언어).
 * 브라우저가 zh-CN·zh-HK·zh처럼 다른 중국어 태그를 주면 zh-TW로, en-US·ja-JP처럼
 * 지역이 붙은 태그는 언어 부분으로 맞춘다(normalizeLocale).
 * 감지 순서: localStorage(§2.2) > navigator.language > 'ko'. 단 언어를 정한 적 없는 첫 방문은
 * 접속 국가로 한 번 더 맞춘다(한국 IP → 한국어, 외국 → 영어, geoLocale.ts). 로그인 사용자의
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
import { detectLocaleByIp } from './geoLocale';
import { isNativeApp } from '@/shared/platform';

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

/** 언어를 한 번도 정한 적 없는 첫 방문인지 — 초기화가 감지한 언어를 저장하기 전에 확인해야 한다 */
function isFirstVisit(): boolean {
  try {
    return !localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    return false;
  }
}

// 첫 방문이면 접속 국가로 언어를 정한다(한국 → 한국어, 외국 → 영어). 초기화와 동시에 물어
// 첫 화면(인트로가 덮고 있는 동안)에 바로 바꾼다. 네이티브 앱은 기기 언어를 따른다.
const ipLocale =
  isFirstVisit() && !isNativeApp() && !pseudoEnabled && import.meta.env.MODE !== 'test' ? detectLocaleByIp() : null;

const instance = i18next.use(ViteGlobBackend).use(LanguageDetector).use(initReactI18next);
if (pseudoEnabled) instance.use(pseudoPostProcessor);

const ready = instance.init({
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

if (ipLocale) {
  void ready.then(async () => {
    const detected = i18next.language;
    const locale = await ipLocale;
    // 기다리는 사이 사용자가 직접 골랐거나(지구본 메뉴) 로그인 프로필 언어로 바뀌었으면 건드리지 않는다
    if (locale && i18next.language === detected && locale !== detected) void i18next.changeLanguage(locale);
  });
}

/** <html lang>은 스크린리더 발음에도 영향을 준다(07-i18n.md §3.2) — 항상 최신 로케일로 유지한다. */
function syncDocumentLocale(locale: string) {
  document.documentElement.lang = locale;
  loadLocaleFont(locale);
}

i18next.on('languageChanged', syncDocumentLocale);
if (i18next.language) syncDocumentLocale(i18next.language);

export default i18next;
