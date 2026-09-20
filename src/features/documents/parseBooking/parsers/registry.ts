/**
 * 결정론적 파서 레지스트리 (04-document-ai.md §4.1, §4.2)
 * LLM보다 먼저 시도한다 — 정형 포맷은 규칙이 더 정확하고, 빠르고, 무료다.
 */
import type { AirportIndex } from '../airports.ts';
import type { ParsedBooking } from '../schema.ts';

export interface ParseContext {
  tripStartDate: string;
  tripEndDate: string;
  locale: 'ko' | 'en' | 'zh-CN';
  airports: AirportIndex;
}

export interface BookingParser {
  /** 'flight/korean-air' 형태 */
  id: string;
  /** bookings.parser_version에 기록된다 */
  version: string;
  /** 0~1. 0.7 이상이면 이 파서를 채택한다 */
  detect(text: string): number;
  parse(text: string, ctx: ParseContext): ParsedBooking[];
}

/** detect() 점수 0.7 이상 중 가장 높은 파서를 고른다(§4.2). 전부 미달이면 null(LLM으로 폴백) */
export function selectParser(parsers: BookingParser[], text: string): BookingParser | null {
  let best: BookingParser | null = null;
  let bestScore = 0;
  for (const parser of parsers) {
    const score = parser.detect(text);
    if (score >= 0.7 && score > bestScore) {
      best = parser;
      bestScore = score;
    }
  }
  return best;
}
