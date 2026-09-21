/**
 * Supabase Edge Function: translate (06-community.md §8)
 *
 * POST { text, source, target }
 * → { translated: string }
 *
 * DB에 저장하지 않는다(§8 "번역 결과는 클라이언트 메모리에만") — 이 함수는
 * 매번 새로 번역해서 돌려주기만 한다. 인증 불필요(비로그인도 커뮤니티 글을
 * 읽을 수 있으므로 번역도 동일하게 열어둔다, 02-screens.md §6).
 *
 * ⚠️ 스펙 원문은 REST 경로를 `/api/translate`(Vercel 서버리스 함수 스타일)로
 * 표기하지만, 이 프로젝트는 AI 키를 쓰는 기능을 전부 Supabase Edge Function으로
 * 통일해왔다(parse-booking, moderate-content와 동일 이유 — 키가 이미
 * Supabase secrets에 등록돼 있음). 계약({text,source,target} → 번역문)은
 * 스펙과 동일, 배포 위치만 다르다.
 *
 * DeepSeek(deepseek-flash, OpenAI 호환 chat/completions) 사용.
 */

const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';
const MODEL = 'deepseek-flash';

function corsHeaders(origin: string | null) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
  }
  headers.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  return headers;
}

function jsonResponse(body: unknown, status: number, headers: Headers) {
  return new Response(JSON.stringify(body), { status, headers });
}

const LOCALE_NAME: Record<string, string> = {
  ko: 'Korean',
  en: 'English',
  'zh-CN': 'Simplified Chinese',
};

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method Not Allowed' }, 405, headers);

  const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY');
  if (!deepseekApiKey) return jsonResponse({ error: '번역 기능을 사용할 수 없습니다.' }, 503, headers);

  let body: { text?: string; source?: string; target?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: '잘못된 요청입니다.' }, 400, headers);
  }
  const text = (body.text ?? '').trim();
  if (!text || text.length > 2000) {
    return jsonResponse({ error: '텍스트가 비었거나 너무 깁니다.' }, 400, headers);
  }
  const targetName = LOCALE_NAME[body.target ?? ''] ?? 'English';
  const sourceName = body.source ? (LOCALE_NAME[body.source] ?? body.source) : 'the source language';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const prompt = `Translate the following text from ${sourceName} to ${targetName}.
Output ONLY the translated text, no quotes, no explanation, no markdown.

Text:
"""
${text}
"""`;
    const res = await fetch(DEEPSEEK_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deepseekApiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error('[translate] non-ok response', res.status, await res.text());
      return jsonResponse({ error: '번역에 실패했습니다.' }, 502, headers);
    }
    const data = await res.json();
    const translated = data?.choices?.[0]?.message?.content?.trim();
    if (!translated) return jsonResponse({ error: '번역에 실패했습니다.' }, 502, headers);
    return jsonResponse({ translated }, 200, headers);
  } catch (err) {
    console.error('[translate] failed:', err instanceof Error ? err.message : err);
    return jsonResponse({ error: '번역에 실패했습니다.' }, 500, headers);
  } finally {
    clearTimeout(timeoutId);
  }
});
