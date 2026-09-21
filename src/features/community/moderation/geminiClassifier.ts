/**
 * Gemini 기반 유해 콘텐츠 분류 (06-community.md §5.1)
 * llm.ts(04-document-ai.md)의 deadline 기반 타임아웃 패턴을 재사용한다.
 * API 키는 인자로만 받는다(Deno.env는 이 모듈이 몰라야 Edge Function 밖에서도
 * 순수 함수로 테스트할 수 있다 — fetch만 모킹하면 됨).
 *
 * 실패(네트워크 에러/타임아웃/파싱 실패)하면 항상 null을 반환한다 — 호출부가
 * fail closed 결정을 내리도록(decideStatus.ts).
 */

export interface ClassifierResult {
  score: number;
  categories: Record<string, number>;
}

function extractJson(text: string): unknown {
  let s = text.trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  return JSON.parse(s);
}

const TEXT_SCHEMA = {
  type: 'object',
  properties: {
    score: { type: 'number' },
    categories: {
      type: 'object',
      properties: {
        sexual: { type: 'number' },
        violence: { type: 'number' },
        hate: { type: 'number' },
        harassment: { type: 'number' },
        self_harm: { type: 'number' },
        illegal: { type: 'number' },
        spam: { type: 'number' },
      },
      required: ['sexual', 'violence', 'hate', 'harassment', 'self_harm', 'illegal', 'spam'],
    },
  },
  required: ['score', 'categories'],
};

function buildTextPrompt(text: string): string {
  return `You are a content safety classifier for a travel community app (Korean/English/Chinese users).
Rate the following user-generated post/comment text for policy violations.
Categories (each 0.0-1.0): sexual, violence, hate, harassment, self_harm, illegal, spam.
"score" = overall severity (max across categories), reflecting how confident you are this
content should be blocked before publishing. Output JSON only, matching the schema. No prose.

Text:
"""
${text}
"""`;
}

export async function classifyText(apiKey: string, text: string, deadlineMs: number): Promise<ClassifierResult | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), deadlineMs);
  try {
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildTextPrompt(text) }] }],
          generationConfig: {
            response_mime_type: 'application/json',
            response_schema: TEXT_SCHEMA,
            temperature: 0,
          },
        }),
        signal: controller.signal,
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) return null;
    const parsed = extractJson(raw) as ClassifierResult;
    if (typeof parsed.score !== 'number') return null;
    return parsed;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildImagePrompt(): string {
  return `You are an image safety classifier for a travel community app.
Rate this image for policy violations: sexual content, graphic violence, hate symbols.
Output JSON only: {"score": 0.0-1.0, "categories": {"sexual": 0-1, "violence": 0-1, "hate": 0-1}}.
"score" is the overall severity (max across categories).`;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

const IMAGE_SCHEMA = {
  type: 'object',
  properties: {
    score: { type: 'number' },
    categories: {
      type: 'object',
      properties: { sexual: { type: 'number' }, violence: { type: 'number' }, hate: { type: 'number' } },
      required: ['sexual', 'violence', 'hate'],
    },
  },
  required: ['score', 'categories'],
};

export async function classifyImageBytes(
  apiKey: string,
  imageBytes: Uint8Array,
  mimeType: string,
  deadlineMs: number,
): Promise<ClassifierResult | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), deadlineMs);
  try {
    const base64 = uint8ToBase64(imageBytes);
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: buildImagePrompt() }, { inline_data: { mime_type: mimeType, data: base64 } }],
            },
          ],
          generationConfig: {
            response_mime_type: 'application/json',
            response_schema: IMAGE_SCHEMA,
            temperature: 0,
          },
        }),
        signal: controller.signal,
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) return null;
    const parsed = extractJson(raw) as ClassifierResult;
    if (typeof parsed.score !== 'number') return null;
    return parsed;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
