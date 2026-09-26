// OpenAI 호환 Chat Completions 호출. OPENROUTER_API_KEY가 있으면 OpenRouter 경유
// DeepSeek를, 없으면 DEEPSEEK_API_KEY로 DeepSeek 공식 API를 직접 쓴다.

function resolveProvider() {
    if (process.env.OPENROUTER_API_KEY) {
        return {
            name: 'OpenRouter',
            url: 'https://openrouter.ai/api/v1/chat/completions',
            key: process.env.OPENROUTER_API_KEY,
            model: 'deepseek/deepseek-chat',
            extraHeaders: { 'HTTP-Referer': 'https://triptic.my', 'X-Title': 'Triptic' },
        };
    }
    if (process.env.DEEPSEEK_API_KEY) {
        return {
            name: 'DeepSeek',
            url: 'https://api.deepseek.com/v1/chat/completions',
            key: process.env.DEEPSEEK_API_KEY,
            model: 'deepseek-chat',
            extraHeaders: {},
        };
    }
    return null;
}

export function hasLlmProvider() {
    return resolveProvider() !== null;
}

/**
 * @returns {Promise<{ content: string, provider: string, model: string }>}
 * 타임아웃·HTTP 오류·빈 응답은 모두 예외로 던진다(호출부가 폴백을 결정).
 */
export async function chatCompletion({ system, user, temperature = 0.7, json = false, timeoutMs = 8000 }) {
    const provider = resolveProvider();
    if (!provider) throw new Error('No LLM provider configured');

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
