/**
 * 출처 가중치 (04-document-ai.md §8)
 * 최종 신뢰도 = min(추출 신뢰도, 검증 점수) × 출처 가중치.
 * min(추출, 검증)은 validate.ts가 필드별로 이미 신뢰도를 낮추는 방식으로
 * 반영해뒀다 — 여기서는 그 결과에 출처 가중치를 곱하기만 한다.
 */
export function sourceWeight(parserUsed: string, detectScore?: number): number {
  if (parserUsed.startsWith('pkpass/') || parserUsed.startsWith('ics/')) return 1.0;
  if (parserUsed.startsWith('llm/gemini')) return 0.85; // 텍스트 기준 — 비전 경로 붙으면 0.75로 분기
  if (parserUsed.startsWith('llm/')) return 0.85;
  // 결정론적 파서: detect≥0.9면 0.98, detect≥0.7이면 0.92
  if (detectScore != null && detectScore >= 0.9) return 0.98;
  return 0.92;
}

interface ConfidenceLeaf {
  value: unknown;
  confidence: number;
}

function isConfidenceLeaf(v: unknown): v is ConfidenceLeaf {
  return (
    typeof v === 'object' &&
    v !== null &&
    'value' in v &&
    'confidence' in v &&
    typeof (v as ConfidenceLeaf).confidence === 'number'
  );
}

/** {value, confidence} 형태의 리프를 재귀적으로 찾아 confidence에 가중치를 곱한다(변형 없이 새 객체 반환) */
export function applySourceWeight<T>(booking: T, weight: number): T {
  if (isConfidenceLeaf(booking)) {
    return { value: booking.value, confidence: Math.max(0, Math.min(1, booking.confidence * weight)) } as T;
  }
  if (Array.isArray(booking)) {
    return booking.map((item) => applySourceWeight(item, weight)) as T;
  }
  if (booking && typeof booking === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(booking)) {
      out[k] = applySourceWeight(v, weight);
    }
    return out as T;
  }
  return booking;
}
