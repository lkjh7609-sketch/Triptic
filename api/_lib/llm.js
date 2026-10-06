// OpenAI 호환 Chat Completions 호출. DeepSeek 공식 API(DEEPSEEK_API_KEY)를 항상 먼저 쓰고,
// 그 키가 없거나 호출이 실패할 때만 OpenRouter 경유 DeepSeek(OPENROUTER_API_KEY)로 대신한다.

/** 쓸 수 있는 공급자를 우선순위대로 — DeepSeek 직접이 먼저 */
function resolveProviders() {
    const providers = [];
    if (process.env.DEEPSEEK_API_KEY) {
        providers.push({
            name: 'DeepSeek',
            url: 'https://api.deepseek.com/chat/completions',
            key: process.env.DEEPSEEK_API_KEY,
            // 현재 모델 이름(예전 deepseek-chat은 문서에서 빠졌다) — 문서 인식(parseBooking/llm.ts)과 같다
            model: 'deepseek-flash',
            // deepseek-flash는 기본이 '생각하는' 모드라 추천 5곳을 만드는 데 20~24초(추론 토큰 약 4,000개)가 걸렸다. 끄면 같은 요청이 5~6초
            // (2026-10-07 직접 측정, 결과 품질은 같고 한국어 문구도 정상). 여기 쓰는 호출(추천·도시 설명)은 추론이 필요 없다
            extraBody: { thinking: { type: 'disabled' } },
            extraHeaders: {},
        });
    }
    if (process.env.OPENROUTER_API_KEY) {
        providers.push({
            name: 'OpenRouter',
            url: 'https://openrouter.ai/api/v1/chat/completions',
            key: process.env.OPENROUTER_API_KEY,
            model: 'deepseek/deepseek-chat',
            extraBody: {},
            extraHeaders: { 'HTTP-Referer': 'https://triptic.my', 'X-Title': 'Triptic' },
        });
    }
    return providers;
}

export function hasLlmProvider() {
    return resolveProviders().length > 0;
}

async function callProvider(provider, { system, user, temperature, json, timeoutMs }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(provider.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${provider.key}`,
                ...provider.extraHeaders,
            },
            body: JSON.stringify({
                model: provider.model,
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: user },
                ],
                temperature,
                ...(json ? { response_format: { type: 'json_object' } } : {}),
                ...provider.extraBody,
            }),
            signal: controller.signal,
        });
        if (!res.ok) throw new Error(`${provider.name} HTTP ${res.status}`);
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content?.trim() ?? '';
        if (!content) throw new Error(`${provider.name} returned empty content`);
        return { content, provider: provider.name, model: data.model || provider.model };
    } finally {
        clearTimeout(timer);
    }
}

/**
 * @returns {Promise<{ content: string, provider: string, model: string }>}
 * DeepSeek 직접 → (실패하면) OpenRouter 순서. 전부 실패하면 마지막 오류를 던진다(호출부가 폴백을 결정).
 * timeoutMs는 공급자 한 곳당 제한, budgetMs는 전체 제한이다 — 첫 곳이 오래 걸린 뒤 대체 공급자까지 각자 제한만큼 기다리면
 * 서버리스 함수의 최대 실행 시간(vercel.json maxDuration)을 넘겨 호출자가 오류 응답을 받기 전에 504가 된다(2026-10-06 recommend).
 * 남은 시간이 MIN_ATTEMPT_MS보다 적으면 다음 공급자는 시도하지 않는다.
 */
export const MIN_ATTEMPT_MS = 2500;
export async function chatCompletion({ system, user, temperature = 0.7, json = false, timeoutMs = 8000, budgetMs = Infinity }) {
    const providers = resolveProviders();
    if (providers.length === 0) throw new Error('No LLM provider configured');
    const deadline = Date.now() + budgetMs;
    let lastError;
    for (const provider of providers) {
        const remaining = deadline - Date.now();
        if (lastError && remaining < MIN_ATTEMPT_MS) break;
        try {
            return await callProvider(provider, { system, user, temperature, json, timeoutMs: Math.min(timeoutMs, remaining) });
        } catch (e) {
            lastError = e;
            console.warn(`[llm] ${provider.name} failed:`, e instanceof Error ? e.message : e);
        }
    }
    throw lastError;
}

/** 코드블록/앞뒤 설명이 섞여 와도 첫 JSON 객체를 꺼낸다 */
export function parseJsonObject(content) {
    try {
        return JSON.parse(content);
    } catch {
        const match = content.match(/\{[\s\S]*\}/);
        if (!match) return null;
        try {
            return JSON.parse(match[0]);
        } catch {
            return null;
        }
    }
}
