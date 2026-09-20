/**
 * LLM 구조화 추출 (04-document-ai.md §6)
 * 결정론적 파서가 실패/부분 성공했을 때만 호출한다(§2 파이프라인 D→E).
 * api/recommend.js의 Gemini→Groq→OpenRouter 폴백 패턴을 그대로 재사용한다.
 *
 * ⚠️ 마스킹(redact.ts) 통과 후의 텍스트만 여기 들어와야 한다 — 이 모듈 자체는
 * 마스킹을 하지 않는다(호출 순서는 엣지 함수 진입점이 보장한다, §2 C단계).
 */
import { z } from 'zod';
import type { ParsedBooking } from './schema.ts';
import { ParsedFlight, ParsedLodging, ParsedRail, ParsedCarRental, ParsedActivity } from './schema.ts';

/** Gemini responseSchema(OpenAPI 3.0 서브셋)는 additionalProperties/$schema를 모른다 —
 * 보내기 전에 재귀적으로 걷어낸다(실측: 남겨두면 400 INVALID_ARGUMENT). */
function stripUnsupportedSchemaKeys(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(stripUnsupportedSchemaKeys);
  if (schema && typeof schema === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(schema)) {
      if (k === 'additionalProperties' || k === '$schema') continue;
      out[k] = stripUnsupportedSchemaKeys(v);
    }
    return out;
  }
  return schema;
}

/** kind별 배열로 감싼다 — Gemini의 구조화 출력은 discriminatedUnion(oneOf)보다
 * 중첩 객체+배열 지원이 훨씬 안정적이라 이 모양으로 요청하고, 응답을 받은 뒤
 * ParsedBooking[]으로 펼친다(extractWithLLM 참고). */
const Envelope = z.object({
  flights: z.array(ParsedFlight.omit({ kind: true })),
  lodgings: z.array(ParsedLodging.omit({ kind: true })),
  rail: z.array(ParsedRail.omit({ kind: true })),
  carRentals: z.array(ParsedCarRental.omit({ kind: true })),
  activities: z.array(ParsedActivity.omit({ kind: true })),
});
type Envelope = z.infer<typeof Envelope>;

const GEMINI_SCHEMA = stripUnsupportedSchemaKeys(z.toJSONSchema(Envelope, { target: 'openapi-3.0' }));

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
  parserUsed: string; // 'llm/gemini-2.5-flash' 등
}

interface ProviderKeys {
  geminiApiKey?: string;
  groqApiKey?: string;
  openrouterApiKey?: string;
}

const MIN_ATTEMPT_MS = 1500;

async function callGemini(apiKey: string, prompt: string, deadline: number): Promise<Envelope | null> {
  if (deadline - Date.now() < MIN_ATTEMPT_MS) return null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), Math.max(500, deadline - Date.now() - 200));
  try {
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            response_mime_type: 'application/json',
            response_schema: GEMINI_SCHEMA,
            temperature: 0,
          },
        }),
        signal: controller.signal,
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    const parsed = Envelope.safeParse(extractJson(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callGroq(apiKey: string, prompt: string, deadline: number): Promise<Envelope | null> {
  if (deadline - Date.now() < MIN_ATTEMPT_MS) return null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), Math.max(500, deadline - Date.now() - 200));
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content:
              'You extract structured travel booking JSON. Always respond strictly in valid JSON without markdown formatting, matching this schema: ' +
              JSON.stringify(GEMINI_SCHEMA),
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

async function callOpenRouter(apiKey: string, prompt: string, deadline: number): Promise<Envelope | null> {
  if (deadline - Date.now() < MIN_ATTEMPT_MS) return null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), Math.max(500, deadline - Date.now() - 200));
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openrouter/free',
        messages: [
          {
            role: 'system',
            content:
              'You extract structured travel booking JSON. Always respond strictly in valid JSON without markdown formatting, matching this schema: ' +
              JSON.stringify(GEMINI_SCHEMA),
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
 * §6.1 공급자 우선순위대로 시도한다: Gemini → Groq → OpenRouter → 실패(null).
 * 실패하면 호출부가 §6.1 "4순위: 빈 수동 입력 폼"으로 폴백한다(기능이 죽지 않게).
 * 스키마 검증 실패 시 provider 함수 내부에서 이미 null을 반환하므로, 여기서는
 * "1회만 재시도"(§6.2)를 같은 provider에 한 번 더 거는 방식으로 구현한다.
 */
export async function extractWithLLM(
  maskedText: string,
  hints: string,
  tripStart: string,
  tripEnd: string,
  keys: ProviderKeys,
  totalBudgetMs = 20_000, // §6.1 "전체 예산 20초"
): Promise<LlmResult | null> {
  const deadline = Date.now() + totalBudgetMs;
  const prompt = buildPrompt(maskedText, hints, tripStart, tripEnd);

  const attempts: Array<[string, () => Promise<Envelope | null>]> = [];
  if (keys.geminiApiKey) {
    const key = keys.geminiApiKey;
    attempts.push(['llm/gemini-2.5-flash', () => callGemini(key, prompt, deadline)]);
    attempts.push(['llm/gemini-2.5-flash', () => callGemini(key, prompt, deadline)]); // 1회 재시도
  }
  if (keys.groqApiKey) {
    const key = keys.groqApiKey;
    attempts.push(['llm/groq-llama-3.3-70b', () => callGroq(key, prompt, deadline)]);
  }
  if (keys.openrouterApiKey) {
    const key = keys.openrouterApiKey;
    attempts.push(['llm/openrouter', () => callOpenRouter(key, prompt, deadline)]);
  }

  for (const [parserUsed, attempt] of attempts) {
    if (Date.now() >= deadline) break;
    const env = await attempt();
    if (env) return { bookings: envelopeToBookings(env), parserUsed };
  }
  return null;
}
