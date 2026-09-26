/**
 * 아주 단순한 언어 감지(휴리스틱) — 06-community.md §8 "게시 시점에 1회 수행".
 * "번역 보기" 버튼 노출 여부만 결정하는 힌트라 정밀도가 중요하지 않다(§8).
 * 별도 NLP 라이브러리를 들이지 않고 문자 범위로만 판정한다.
 * 일본어는 한자를 섞어 쓰므로 가나(ひらがな/カタカナ)를 한자보다 먼저 본다.
 * 중국어는 앱이 번체(zh-TW)만 지원하므로 한자만 있으면 zh-TW로 본다.
 */
export type DetectedLanguage = 'ko' | 'ja' | 'zh-TW' | 'en';

export function detectLanguage(text: string): DetectedLanguage {
  if (/[가-힣]/.test(text)) return 'ko';
  if (/[\u3040-\u30ff]/.test(text)) return 'ja';
  if (/[\u4e00-\u9fff]/.test(text)) return 'zh-TW';
  return 'en';
}
