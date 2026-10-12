import { useTranslation } from 'react-i18next';
import { normalizeLocale, type SupportedLocale } from './i18n';

export type LegalKind = 'terms' | 'privacy';

/**
 * 이용약관·개인정보처리방침 정적 페이지 주소 — 앱 언어에 맞는 번역본(`terms-en.html` 등)으로 연결한다(2026-10-12).
 * 한국어는 기본 주소에 `?lang=ko`를 붙여, 기기·브라우저 언어가 다르더라도 그 페이지의 자동 언어 이동이 일어나지 않게 한다.
 * 앱(iOS)에서는 이 주소를 externalLink가 운영 사이트 주소의 인앱 브라우저로 연다.
 */
export function legalPath(kind: LegalKind, lang: string | null | undefined): string {
  const locale: SupportedLocale = normalizeLocale(lang);
  return locale === 'ko' ? `/${kind}.html?lang=ko` : `/${kind}-${locale}.html`;
}

/** 지금 앱 언어의 약관·방침 주소 */
export function useLegalLinks(): { terms: string; privacy: string } {
  const { i18n } = useTranslation();
  return { terms: legalPath('terms', i18n.language), privacy: legalPath('privacy', i18n.language) };
}
