/* i18n-exempt-file: LLM 추출 프롬프트 — 한국어 예약 문서 표기 예시를 그대로 담는다 */
/**
 * LLM 구조화 추출 (04-document-ai.md §6)
 * 문서 텍스트(PDF 글자층 또는 OCR 결과, kordoc Markdown)에서 예약을 뽑는다. 결정론적 파서가
 * 찾은 값은 힌트로만 넘기고 LLM 결과를 주로 쓴다(파이프라인 pipeline.ts).
 *
 * ⚠️ 마스킹(redact.ts) 통과 후의 텍스트만 여기 들어와야 한다 — 이 모듈 자체는
 * 마스킹을 하지 않는다(호출 순서는 파이프라인이 보장한다, §2 C단계).
 *
 * DeepSeek 공식 API(deepseek-flash)를 먼저, 키가 없거나 실패하면 OpenRouter 경유 DeepSeek.
 * 응답은 필드 단위로 너그럽게 정리한다(llmNormalize.ts) — 필드 하나가 형식에 어긋났다고
 * 응답 전체를 버리지 않는다.
 */
import { z } from 'zod';
import type { ParsedBooking } from './schema.ts';
import { ParsedFlight, ParsedLodging, ParsedRail, ParsedCarRental, ParsedActivity } from './schema.ts';
import { normalizeLlmEnvelope } from './llmNormalize.ts';

/** kind별 배열로 감싼다 — discriminatedUnion(oneOf)보다 중첩 객체+배열 지원이
 * 안정적이라 이 모양으로 요청하고, 응답을 받은 뒤 ParsedBooking[]으로 펼친다. */
const Envelope = z.object({
  flights: z.array(ParsedFlight.omit({ kind: true })),
  lodgings: z.array(ParsedLodging.omit({ kind: true })),
  rail: z.array(ParsedRail.omit({ kind: true })),
  carRentals: z.array(ParsedCarRental.omit({ kind: true })),
  activities: z.array(ParsedActivity.omit({ kind: true })),
});

const RESPONSE_SCHEMA = z.toJSONSchema(Envelope);

/**
 * 추출 규칙. OCR 결과(사진·스크린샷)에서 실제로 틀린 유형을 반영했다 — 날짜·편명의 O/0 혼동,
 * 표가 줄바꿈되며 값이 흩어짐, 라벨과 값이 한 칸에 붙음, 한글 흔한 단어 오타, 예약번호와
 * 항공권 번호 혼동. 규칙은 특정 문서가 아니라 유형으로 적는다.
 */
export const EXTRACTION_RULES = `You extract travel bookings from one document. The text came from PDF text extraction or from OCR of a photo/screenshot, converted to Markdown (tables may be Markdown pipes or HTML).

Output
1. Output one JSON object matching the provided schema. No prose, no markdown fences.
2. Every leaf is {"value": ..., "confidence": 0.0-1.0}. Confidence = how directly the value is printed; lower it when you inferred or corrected something.
3. NEVER invent values. If a field is not clearly present, use {"value": null, "confidence": 0}.
4. One entry per flight segment (a round trip is 2 flights; multi-city = one per leg). One entry per hotel stay. Train tickets (KTX, SRT, Shinkansen, Eurostar, Amtrak...) go to "rail", never "flights"; rail.trainNumber keeps the train type as printed ("KTX 023", "SRT 341", "ICE 578"). Tours, attraction tickets and activities go to "activities".

Dates and times
5. Return LOCAL date-time as printed at that place: "YYYY-MM-DDTHH:mm" (24-hour, no seconds, no timezone).
6. Convert 12-hour times: "3:00 PM" -> 15:00, "11:40pm" -> 23:40, "오후 4:00" -> 16:00, "오전 11:00" -> 11:00. "2355" in a ticket time column means 23:55.
7. Date formats you will see: 07OCT26, 07 Oct 2026, Wed 07 Oct 2026, Nov 16, 2026, 2026.10.07, 2026-10-07, 2026년 10월 7일, 10월 7일 (수), 22/03/2027 (day/month/year outside the US). If the year is missing, choose the year that puts the date inside or nearest to the trip dates.
8. "+1" / "+1일" / "(+1)" after a time means the next calendar day. Long overnight flights arrive on a later date than they depart.
9. A printed departure time (Departure, Dep, STD, 출발, 출발 시각) is the departure time, also on boarding passes. Only when NO departure time is printed and the document shows just the flight date plus a boarding time (Boarding, 탑승 시각), return the date alone ("YYYY-MM-DD") for departure.scheduledLocal with confidence <= 0.3 — the boarding time is not the departure time. Leave arrival null if it is not printed.
10. Hotel check-in/check-out: combine the date with the stated time ("from 3:00 PM" -> 15:00, "14:00 이후" -> 14:00, "until 12:00 PM" -> 12:00, "11:00 이전" -> 11:00). If no time is printed, use T00:00 with confidence <= 0.3.

OCR errors (the text may contain them)
11. Look-alike characters get swapped: letter O vs digit 0, I/l vs 1, S vs 5, B vs 8, Z vs 2, D vs 0, T vs I. Inside dates, times, flight numbers and airport codes, read them as the only sensible value (070CT26 = 07OCT26, 0Z104 = OZ104, O8:1O = 08:10, 1140pm = 11:40pm). If you corrected a character, cap that field's confidence at 0.7.
12. Airport codes: use the city names and the other segments of the same document to pick the right code when OCR mangled it (e.g. a Tokyo route printed as "NRI" is NRT). Only return a code that is printed or clearly intended; never derive a code from a city name alone.
13. OCR of tables may split one value across lines or cells, or glue a label onto a value (e.g. "QF7T9M Frequent flyer" in one cell, a name split over two lines, "BA" and "2714" in separate lines). Reassemble values by meaning, not by position.
14. Korean OCR can misspell common words (트원 -> 트윈, 스텐다드 -> 스탠다드, 승격 -> 승객). Fix obvious typos in common words, but copy proper nouns (hotel, property, place and person names) exactly as printed.

Identifiers
15. bookingReference: the airline PNR / 예약번호 / booking or confirmation code, usually 5-8 letters and digits. It is NOT the 13-digit ticket number (e.g. 180-2384756190, 081 2193847560) and NOT a payment or order id when a separate PNR exists. For a flight booked through a travel agency, prefer the airline PNR ("airline confirmation", "항공사 예약번호") over the agency itinerary number. For lodging use the hotel or booking-site confirmation number.
16. Numeric booking numbers are often printed in groups separated by spaces, dots or hyphens (1587 2093 44, 4127.339.058, IP-7734-2291), and OCR may shift the spaces (15872093 44). Keep every group of the same number together in one reference. Copy booking references exactly as printed; never "correct" their characters. If one contains O, 0, I, 1, L, S, 5, B, 8, Z or 2, cap its confidence at 0.6.
17. flightNumber: 2-character airline code + 1-4 digits, no space ("BA 2714" -> "BA2714", "OZ 102" -> "OZ102"). carrierIata = that code. For code-share lines ("Operated by ..."), keep the flight number printed for the segment.
18. terminal: only the identifier ("T1", "Terminal 1", "터미널 1" -> "1"). cabinClass: economy / premium_economy / business / first (일반석, Economy, Y and other economy fare letters -> economy; 비즈니스, Business, C, J -> business; First, 일등석, F -> first).
19. Values like [PASSPORT], [CARD], [EMAIL], [PHONE], [NATIONAL_ID], [MEMBER_NO] are redacted. Treat them as absent and do not reconstruct them.`;

function buildPrompt(maskedText: string, hints: string, tripStart: string, tripEnd: string): string {
  return `${EXTRACTION_RULES}

Rule-based candidates (a simple regex pass — often incomplete or mixed up on multi-segment documents; the document text always wins when they conflict):
${hints || '(none)'}

Trip dates: ${tripStart} to ${tripEnd}

Document text:
${maskedText}`;
}

function extractJson(text: string): unknown {
  let jsonStr = text.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  try {
    return JSON.parse(jsonStr);
  } catch {
    const m = jsonStr.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  }
}

export interface LlmResult {
  bookings: ParsedBooking[];
  /** 'llm/deepseek-flash' | 'llm/openrouter-deepseek' */
  parserUsed: string;
}

export interface ProviderKeys {
  deepseekApiKey?: string;
  openrouterApiKey?: string;
}

/**
 * fast: 추론(thinking) 끔 — 1~3초. careful: 추론 low — 5~30초, 흐린 사진·다구간 여정처럼 어려운 문서에서
 * 더 정확하다(52개 문서 비교: 흐린 사진 95.3% → 97.6%). 파이프라인이 fast 결과를 검증해 필요할 때만 careful.
 */
export type LlmEffort = 'fast' | 'careful';

interface Provider {
  id: string;
  url: string;
  key: string;
  model: string;
  headers?: Record<string, string>;
  /** 요청 본문에 더할 값(DeepSeek 추론 옵션) */
  extra?: Record<string, unknown>;
}

/** DeepSeek 공식 API가 먼저 — OpenRouter는 그 키가 없거나 실패했을 때만 */
function providers(keys: ProviderKeys, effort: LlmEffort): Provider[] {
  const list: Provider[] = [];
  if (keys.deepseekApiKey) {
    list.push({
      id: 'llm/deepseek-flash',
      url: 'https://api.deepseek.com/chat/completions',
      key: keys.deepseekApiKey,
      model: 'deepseek-flash',
      // 기본은 추론 켜짐·강도 high(느리고 가끔 40초 넘게 걸림) — 명시적으로 고른다
      extra: effort === 'fast' ? { thinking: { type: 'disabled' } } : { reasoning_effort: 'low' },
    });
  }
  if (keys.openrouterApiKey) {
    list.push({
      id: 'llm/openrouter-deepseek',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      key: keys.openrouterApiKey,
      model: 'deepseek/deepseek-chat',
      headers: { 'HTTP-Referer': 'https://triptic.my', 'X-Title': 'Triptic' },
    });
  }
  return list;
}

const MIN_ATTEMPT_MS = 1500;
/** 한 번 시도의 최대 시간 — 응답이 없으면 다음 시도(재시도·OpenRouter)로 넘어간다 */
const ATTEMPT_CAP_MS: Record<LlmEffort, number> = { fast: 12_000, careful: 30_000 };

async function callProvider(p: Provider, prompt: string, deadline: number, capMs: number): Promise<ParsedBooking[] | null> {
  if (deadline - Date.now() < MIN_ATTEMPT_MS) return null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), Math.max(500, Math.min(capMs, deadline - Date.now() - 200)));
  try {
    const res = await fetch(p.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json', ...p.headers },
      body: JSON.stringify({
        model: p.model,
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
        ...p.extra,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text) return null;
    const raw = extractJson(text);
    if (!raw || typeof raw !== 'object') return null;
    return normalizeLlmEnvelope(raw);
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * DeepSeek 직접 → (실패하면) 한 번 더 → OpenRouter 순서로 시도한다(§6.2).
 * 전부 실패하면 null — 호출부가 결정론적 파서 결과나 빈 수동 입력 폼으로 폴백한다.
 */
export async function extractWithLLM(
  maskedText: string,
  hints: string,
  tripStart: string,
  tripEnd: string,
  keys: ProviderKeys,
  totalBudgetMs = 30_000,
  effort: LlmEffort = 'fast',
): Promise<LlmResult | null> {
  const list = providers(keys, effort);
  if (list.length === 0) return null;
  const deadline = Date.now() + totalBudgetMs;
  const prompt = buildPrompt(maskedText, hints, tripStart, tripEnd);
  // 빠른 추출: 첫 공급자 두 번(일시 오류 대비) → 다음 공급자. 신중 추출: 같은 느린 요청을 되풀이하지
  // 않고 한 번씩만(시간 안에 못 끝나면 호출부가 빠른 결과를 검증 경고와 함께 쓴다)
  const attempts = effort === 'fast' ? [list[0], list[0], ...list.slice(1)] : list;
  for (const p of attempts) {
    if (Date.now() >= deadline) break;
    const bookings = await callProvider(p, prompt, deadline, ATTEMPT_CAP_MS[effort]);
    if (bookings) return { bookings, parserUsed: p.id };
  }
  return null;
}
