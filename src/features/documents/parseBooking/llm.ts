/**
 * LLM 구조화 추출 (04-document-ai.md §6)
 * 결정론적 파서가 실패/부분 성공했을 때만 호출한다(§2 파이프라인 D→E).
 *
 * ⚠️ 마스킹(redact.ts) 통과 후의 텍스트만 여기 들어와야 한다 — 이 모듈 자체는
 * 마스킹을 하지 않는다(호출 순서는 엣지 함수 진입점이 보장한다, §2 C단계).
 *
 * DeepSeek(deepseek-flash, OpenAI 호환 chat/completions) 사용.
 */
import { z } from 'zod';
import type { ParsedBooking } from './schema.ts';
import { ParsedFlight, ParsedLodging, ParsedRail, ParsedCarRental, ParsedActivity } from './schema.ts';

/** kind별 배열로 감싼다 — discriminatedUnion(oneOf)보다 중첩 객체+배열 지원이
 * 안정적이라 이 모양으로 요청하고, 응답을 받은 뒤 ParsedBooking[]으로 펼친다
 * (extractWithLLM 참고). */
const Envelope = z.object({
  flights: z.array(ParsedFlight.omit({ kind: true })),
  lodgings: z.array(ParsedLodging.omit({ kind: true })),
  rail: z.array(ParsedRail.omit({ kind: true })),
  carRentals: z.array(ParsedCarRental.omit({ kind: true })),
  activities: z.array(ParsedActivity.omit({ kind: true })),
});
type Envelope = z.infer<typeof Envelope>;

const RESPONSE_SCHEMA = z.toJSONSchema(Envelope);

function buildPrompt(maskedText: string, hints: string, tripStart: string, tripEnd: string): string {
  return `You extract travel booking data from documents. Rules:

1. Output JSON matching the provided schema. No prose, no markdown.
2. NEVER invent values. If a field is not clearly present, use null.
3. Times printed on tickets are LOCAL times at that location.
   Return them as "YYYY-MM-DDTHH:mm" with NO timezone offset.
4. Return an IATA code only if it is explicitly printed. Do not guess
   a code from a city name.
5. For each field, return a confidence 0.0-1.0 reflecting how directly
   the value was stated in the document. Lower it when you inferred.
6. Some values are redacted as [PASSPORT], [CARD], [EMAIL] etc.
   Treat them as absent. Do not attempt to reconstruct them.
7. A document may contain multiple bookings (round trip, multi-leg).
   Return every one of them in the matching array; leave other arrays empty.

Verified hints from rule-based parsing (trust these over your own reading):
${hints || '(none)'}

Trip context: ${tripStart} to ${tripEnd}

Document text:
${maskedText}`;
}

function envelopeToBookings(env: Envelope): ParsedBooking[] {
  return [
    ...env.flights.map((b): ParsedBooking => ({ kind: 'flight', ...b })),
    ...env.lodgings.map((b): ParsedBooking => ({ kind: 'lodging', ...b })),
    ...env.rail.map((b): ParsedBooking => ({ kind: 'rail', ...b })),
    ...env.carRentals.map((b): ParsedBooking => ({ kind: 'car_rental', ...b })),
    ...env.activities.map((b): ParsedBooking => ({ kind: 'activity', ...b })),
  ];
}

function extractJson(text: string): unknown {
  let jsonStr = text.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  return JSON.parse(jsonStr);
}

export interface LlmResult {
  bookings: ParsedBooking[];
  parserUsed: string; // 'llm/deepseek-flash'
}

interface ProviderKeys {
  deepseekApiKey?: string;
}

const MIN_ATTEMPT_MS = 1500;
const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';
const MODEL = 'deepseek-flash';

async function callDeepSeek(apiKey: string, prompt: string, deadline: number): Promise<Envelope | null> {
  if (deadline - Date.now() < MIN_ATTEMPT_MS) return null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), Math.max(500, deadline - Date.now() - 200));
  try {
    const res = await fetch(DEEPSEEK_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You extract structured travel booking JSON. Always respond strictly in valid JSON without markdown formatting, matching this schema: ' +
              JSON.stringify(RESPONSE_SCHEMA),
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) return null;
    const parsed = Envelope.safeParse(extractJson(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * DeepSeek로 추출을 시도하고, 실패하면 같은 공급자에 1회만 재시도한다(§6.2).
 * 그래도 실패하면 호출부가 §6.1 "4순위: 빈 수동 입력 폼"으로 폴백한다(기능이 죽지 않게).
 */
export async function extractWithLLM(
  maskedText: string,
  hints: string,
  tripStart: string,
  tripEnd: string,
  keys: ProviderKeys,
  totalBudgetMs = 20_000, // §6.1 "전체 예산 20초"
): Promise<LlmResult | null> {
  if (!keys.deepseekApiKey) return null;
  const deadline = Date.now() + totalBudgetMs;
  const prompt = buildPrompt(maskedText, hints, tripStart, tripEnd);
  const key = keys.deepseekApiKey;
  const parserUsed = 'llm/deepseek-flash';

  for (let attempt = 0; attempt < 2; attempt++) {
    if (Date.now() >= deadline) break;
    const env = await callDeepSeek(key, prompt, deadline);
    if (env) return { bookings: envelopeToBookings(env), parserUsed };
  }
  return null;
}
