/**
 * 파서 레지스트리 (04-document-ai.md §4.1)
 * 항공사·OTA 전용 파서는 실제 예약 문서로 검증하며 하나씩 늘려간다 — 검증
 * 안 된 정규식을 "전용 파서"라고 주장하면 §1의 "조용한 자동 확정 금지"
 * 원칙과 충돌한다(틀린 패턴이 높은 신뢰도로 자동 채택될 수 있음). 지금은
 * 폴백 파서 하나만 등록돼 있고, 그 밖의 모든 문서는 §6 LLM 추출로 넘어간다.
 */
import { genericIataParser } from './flight/generic-iata';
import type { BookingParser } from './registry';

export const ALL_PARSERS: BookingParser[] = [genericIataParser];

export { selectParser } from './registry';
export type { BookingParser, ParseContext } from './registry';
