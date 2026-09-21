/**
 * 의사 로케일 (07-i18n.md §10)
 * `VITE_PSEUDO_LOCALE=1`로 빌드하면 모든 번역 문자열을 레이아웃 스트레스
 * 테스트용으로 부풀린다(길이 +40%, 발음 구별 기호로 문자 치환). 실제 3개
 * 언어와 무관 — 레이아웃이 긴 번역을 견디는지 화면별로 훑어보기 위한 도구다.
 */
import type { PostProcessorModule } from 'i18next';

const ACCENT_MAP: Record<string, string> = {
  a: 'ä', e: 'ë', i: 'ï', o: 'ö', u: 'ü',
  A: 'Ä', E: 'Ë', I: 'Ï', O: 'Ö', U: 'Ü',
};

function pseudoize(text: string): string {
  const accented = text.replace(/[aeiouAEIOU]/g, (c) => ACCENT_MAP[c] ?? c);
  const padLength = Math.max(2, Math.ceil(text.length * 0.4));
  const padding = '~'.repeat(Math.ceil(padLength / 2));
  return `[!!${padding}${accented}${padding}!!]`;
}

export const PSEUDO_POST_PROCESSOR_NAME = 'pseudo';

export const pseudoPostProcessor: PostProcessorModule = {
  type: 'postProcessor',
  name: PSEUDO_POST_PROCESSOR_NAME,
  process(value: string) {
    return pseudoize(value);
  },
};

export function isPseudoLocaleEnabled(): boolean {
  return import.meta.env.VITE_PSEUDO_LOCALE === '1';
}
