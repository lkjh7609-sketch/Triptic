/**
 * 아주 단순한 언어 감지(휴리스틱) — 06-community.md §8 "게시 시점에 1회 수행".
 * "번역 보기" 버튼 노출 여부만 결정하는 힌트라 정밀도가 중요하지 않다(§8).
 * 별도 NLP 라이브러리를 들이지 않고 문자 범위로만 판정한다.
 */
export function detectLanguage(text: string): 'ko' | 'zh-CN' | 'en' {
  if (/[가-힣]/.test(text)) return 'ko';
  if (/[一-鿿]/.test(text)) return 'zh-CN';
  return 'en';
}
