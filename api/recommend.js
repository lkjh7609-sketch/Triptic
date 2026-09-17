// Vercel Serverless Function: Multi-Provider Free AI Nearby Recommendations
// Providers Supported: Google Gemini API (Free 1,500/day), Groq API (Free 14,400/day), OpenRouter
// EndPoint: POST /api/recommend

let cachedOpenRouterModels = null;
let lastCacheTime = 0;

// 1. Google Gemini API (가장 안정적 & 고성능: 하루 1,500회 완전 무료, 초고속, 구조화 JSON 지원)
async function callGemini(apiKey, prompt) {
    const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'];
    for (const model of models) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 9500);
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        response_mime_type: 'application/json',
                        temperature: 0.7
                    }
                }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!res.ok) {
                const err = await res.text();
                console.warn(`[Gemini] ${model} 실패 (${res.status}):`, err);
                continue;
            }

            const data = await res.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) continue;

            let jsonStr = text.trim();
            if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
            }

            const parsed = JSON.parse(jsonStr);
            if (parsed && Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
                return {
                    provider: 'Google Gemini',
                    modelUsed: `google/${model}`,
                    recommendations: parsed.recommendations
                };
            }
        } catch (e) {
            console.warn(`[Gemini] ${model} 에러:`, e.message);
        }
    }
    return null;
}

// 2. Groq API (초고속 LPU: 하루 14,400회 무료, LLaMA 3.3 70B)
async function callGroq(apiKey, prompt) {
    const models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
    for (const model of models) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 9500);
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: 'system', content: 'You are a professional travel assistant. Always respond strictly in valid JSON without markdown formatting.' },
                        { role: 'user', content: prompt }
                    ],
                    response_format: { type: 'json_object' },
                    temperature: 0.7
                }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!res.ok) continue;

            const data = await res.json();
            const text = data.choices?.[0]?.message?.content;
            if (!text) continue;

            let jsonStr = text.trim();
            if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
            }

            const parsed = JSON.parse(jsonStr);
            if (parsed && Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
                return {
                    provider: 'Groq Cloud',
                    modelUsed: `groq/${model}`,
                    recommendations: parsed.recommendations
                };
            }
        } catch (e) {
            console.warn(`[Groq] ${model} 에러:`, e.message);
        }
    }
    return null;
}

// 3. OpenRouter API
async function getOpenRouterCandidateModels(apiKey) {
    const now = Date.now();
    if (cachedOpenRouterModels && (now - lastCacheTime < 10 * 60 * 1000)) {
        return cachedOpenRouterModels;
    }

    const candidates = ['openrouter/free'];
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const res = await fetch('https://openrouter.ai/api/v1/models', {
            headers: { 'Authorization': `Bearer ${apiKey}` },
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
            const data = await res.json();
            const models = data.data || [];
            const dynamicFree = models
                .filter(m => {
                    const isFree = m.id.endsWith(':free') || (m.pricing && m.pricing.prompt === '0' && m.pricing.completion === '0');
                    const isSpecial = m.id.includes('safety') || m.id.includes('lyria') || m.id.includes('clip');
                    return isFree && !isSpecial && m.id !== 'openrouter/free';
                })
                .map(m => m.id);

            candidates.push(...dynamicFree.slice(0, 5));
        }
    } catch (e) {}

    const fallbacks = [
        'google/gemma-4-31b-it:free',
        'nvidia/nemotron-3-super-120b-a12b:free',
        'liquid/lfm-2.5-2.6b:free'
    ];
    fallbacks.forEach(fb => {
        if (!candidates.includes(fb)) candidates.push(fb);
    });

    cachedOpenRouterModels = candidates;
    lastCacheTime = now;
    return candidates;
}

async function callOpenRouter(apiKey, prompt) {
    const candidateModels = await getOpenRouterCandidateModels(apiKey);
    let lastError = null;

    for (const model of candidateModels) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 9500);

            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': 'https://triptic-ten.vercel.app',
                    'X-Title': 'Triptic Travel Planner',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: 'system', content: 'You are a professional travel assistant. Always respond strictly in valid JSON without any markdown formatting.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.7,
                    max_tokens: 1500
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errText = await response.text();
                lastError = `Model ${model} (${response.status}): ${errText}`;
                continue;
            }

            const data = await response.json();
            const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
            if (!content) continue;

            let jsonStr = content.trim();
            if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
            }

            const parsed = JSON.parse(jsonStr);
            if (parsed && Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
                return {
                    provider: 'OpenRouter',
                    modelUsed: model,
                    recommendations: parsed.recommendations
                };
            }
        } catch (err) {
            lastError = err.message || String(err);
        }
    }
    return { error: lastError };
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;
    const openrouterKey = process.env.OPENROUTER_API_KEY;

    if (!geminiKey && !groqKey && !openrouterKey) {
        return res.status(500).json({
            error: 'AI API 키가 등록되지 않았습니다. Vercel 환경 변수에 GEMINI_API_KEY 또는 OPENROUTER_API_KEY를 등록해주세요.'
        });
    }

    const { placeName, city, category } = req.body || {};
    if (!placeName) {
        return res.status(400).json({ error: '기준 장소 이름(placeName)이 필요합니다.' });
    }

    const locationContext = city ? `${city}의 '${placeName}'` : `'${placeName}'`;
    const categoryFocus = category && category !== 'all' 
        ? `특히 [${category}] 분야에 집중해서` 
        : '로컬 맛집, 분위기 좋은 카페, 동선에 최적화된 숙소, 가볼 만한 인근 명소를 골고루';

    const prompt = `
당신은 현지 지리에 정통한 전문 여행 가이드입니다.
${locationContext} 주변에서 여행객이 실제로 도보나 대중교통으로 가기 좋은 장소 4~6곳을 추천해주세요.
${categoryFocus} 엄선해 주세요.

반드시 아래 JSON 형식으로만 응답해야 하며, 마크다운 코드블록이나 다른 설명 없이 순수 JSON만 출력하세요:
{
  "recommendations": [
    {
      "name": "정확한 상호명 및 한국어 명칭 (예: 앗치치혼포 도톤보리 본점)",
      "category": "restaurant | cafe | hotel | spot",
      "categoryLabel": "로컬 맛집 | 감성 카페 | 숙소 | 주변 명소",
      "distance": "도보 3분 (250m) 또는 이동 소요시간",
      "estimatedRating": 4.6,
      "signatureMenu": "대표 시그니처 메뉴 또는 특징 (예: 타코야키 9알 600엔)",
      "priceRange": "예: 1인당 1,000~2,000엔",
      "reason": "추천 이유 1~2문장 (현지 분위기, 맛의 특징 등)",
      "tip": "실전 방문 꿀팁 (예: 웨이팅 팁, 브레이크타임, 추천 시간대)"
    }
  ]
}
`.trim();

    // 1순위: Google Gemini API (하루 1,500회 무료, 가장 안정적이고 빠름)
    if (geminiKey) {
        const result = await callGemini(geminiKey, prompt);
        if (result && result.recommendations) {
            return res.status(200).json({
                success: true,
                provider: result.provider,
                modelUsed: result.modelUsed,
                basePlace: placeName,
                recommendations: result.recommendations
            });
        }
    }

    // 2순위: Groq API (하루 14,400회 무료, 초고속)
    if (groqKey) {
        const result = await callGroq(groqKey, prompt);
        if (result && result.recommendations) {
            return res.status(200).json({
                success: true,
                provider: result.provider,
                modelUsed: result.modelUsed,
                basePlace: placeName,
                recommendations: result.recommendations
            });
        }
    }

    // 3순위: OpenRouter API (무료 모델 순회)
    if (openrouterKey) {
        const result = await callOpenRouter(openrouterKey, prompt);
        if (result && result.recommendations) {
            return res.status(200).json({
                success: true,
                provider: result.provider,
                modelUsed: result.modelUsed,
                basePlace: placeName,
                recommendations: result.recommendations
            });
        }
        if (result && result.error) {
            return res.status(502).json({
                error: 'AI 추천을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',
                detail: result.error,
                hint: 'OpenRouter 일일 무료 한도(50회)가 초과되었을 수 있습니다. Google AI Studio(하루 1,500회 무료)에서 키를 발급받아 Vercel 환경 변수에 GEMINI_API_KEY로 등록하시면 즉시 무제한급으로 이용 가능합니다.'
            });
        }
    }

    return res.status(502).json({
        error: 'AI 추천을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
    });
};
