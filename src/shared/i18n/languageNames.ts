/* i18n-exempt-file: 언어 선택 목록은 각 언어의 자기 이름(autonym)으로 보여주는 게 표준이다. */
import type { SupportedLocale } from './index';

/** 언어 선택 UI에 쓰는 각 언어의 자기 이름 — 어떤 표시 언어에서도 번역하지 않는다 */
export const LANGUAGE_AUTONYMS: Record<SupportedLocale, string> = {
  ko: '한국어',
  en: 'English',
  'zh-TW': '繁體中文',
  ja: '日本語',
};
