/**
 * DeepSeek(deepseek-flash) 기반 유해 콘텐츠 분류 (06-community.md §5.1)
 * OpenAI 호환 chat/completions API. llm.ts(04-document-ai.md)의 deadline
 * 기반 타임아웃 패턴을 재사용한다.
 * API 키는 인자로만 받는다(Deno.env는 이 모듈이 몰라야 Edge Function 밖에서도
 * 순수 함수로 테스트할 수 있다 — fetch만 모킹하면 됨).
 *
 * 실패(네트워크 에러/타임아웃/파싱 실패)하면 항상 null을 반환한다 — 호출부가
 * fail closed 결정을 내리도록(decideStatus.ts).
 */

const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';
const MODEL = 'deepseek-flash';

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

function buildTextPrompt(text: string): string {
  return `You are a content safety classifier for a travel community app (Korean/English/Chinese users).
Rate the following user-generated post/comment text for policy violations.
Categories (each 0.0-1.0): sexual, violence, hate, harassment, self_harm, illegal, spam.
"score" = overall severity (max across categories), reflecting how confident you are this
content should be blocked before publishing.
Output ONLY a JSON object with this exact shape, no prose, no markdown:
{"score": number, "categories": {"sexual": number, "violence": number, "hate": number, "harassment": number, "self_harm": number, "illegal": number, "spam": number}}

Text:
"""
${text}
"""`;
}

async function callDeepSeek(
  apiKey: string,
  content: string | unknown[],
  deadlineMs: number,
): Promise<ClassifierResult | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), deadlineMs);
  try {
    const res = await fetch(DEEPSEEK_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content }],
        response_format: { type: 'json_object' },
        temperature: 0,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error('[deepseekClassifier] non-ok response', res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) {
      console.error('[deepseekClassifier] no content in response', JSON.stringify(data));
      return null;
    }
    const parsed = extractJson(raw) as ClassifierResult;
    if (typeof parsed.score !== 'number') {
      console.error('[deepseekClassifier] parsed score not a number', raw);
      return null;
    }
    return parsed;
  } catch (err) {
    console.error('[deepseekClassifier] exception', err instanceof Error ? err.message : String(err));
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function classifyText(apiKey: string, text: string, deadlineMs: number): Promise<ClassifierResult | null> {
  return callDeepSeek(apiKey, buildTextPrompt(text), deadlineMs);
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

const IMAGE_PROMPT = `You are an image safety classifier for a travel community app.
Rate this image for policy violations: sexual content, graphic violence, hate symbols.
Output ONLY a JSON object with this exact shape, no prose, no markdown:
{"score": number, "categories": {"sexual": number, "violence": number, "hate": number}}
"score" is the overall severity (max across categories).`;

export async function classifyImageBytes(
  apiKey: string,
  imageBytes: Uint8Array,
  mimeType: string,
  deadlineMs: number,
): Promise<ClassifierResult | null> {
  const base64 = uint8ToBase64(imageBytes);
  const content = [
    { type: 'text', text: IMAGE_PROMPT },
    { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
  ];
  return callDeepSeek(apiKey, content, deadlineMs);
}
