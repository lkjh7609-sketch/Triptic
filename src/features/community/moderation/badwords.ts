/**
 * 금칙어 사전 (ko/en/zh, 06-community.md §5.1)
 * 완전한 사전은 아니다 — 명백한 심각 수준 표현 위주의 결정론적 백스톱이고,
 * 실제 판단은 Gemini 텍스트 분류기가 주로 담당한다(llm.ts). 이 목록은
 * 분류기가 실패했을 때도(fail closed 이전에) 최소한의 즉시 차단을 보장한다.
 */
import { normalizeForModeration } from './normalizeText.ts';

const BADWORDS = [
  // 한국어
  '씨발', '씨팔', '시발', '시팔', 'ㅅㅂ', 'ㅆㅂ', '병신', 'ㅂㅅ', '개새끼', '새끼야', '좆같',
  '지랄', '느금마', '느그엄마', '창녀', '걸레같은', '죽여버', '자살해',
  // 영어
  'fuck', 'shit', 'bitch', 'asshole', 'nigger', 'faggot', 'cunt', 'kill yourself',
  // 중국어(간체)
  '操你妈', '傻逼', '狗屎', '婊子', '妈的', '去死',
].map(normalizeForModeration);

/** 정규화된 텍스트에 금칙어가 포함돼 있으면 1.0(즉시 차단 수준), 없으면 0을 반환한다 */
export function badwordScore(rawText: string): number {
  const normalized = normalizeForModeration(rawText);
  return BADWORDS.some((word) => word.length > 0 && normalized.includes(word)) ? 1.0 : 0;
}
