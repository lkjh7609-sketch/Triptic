// Vercel Serverless Function: OpenRouter Dynamic Free AI Nearby Recommendations
// EndPoint: POST /api/recommend

let cachedFreeModels = null;
let lastCacheTime = 0;

// OpenRouter 공식 무료 자동 라우터 및 실시간 활성 무료 모델 목록 조회
async function getCandidateFreeModels(apiKey) {
    const now = Date.now();
    if (cachedFreeModels && (now - lastCacheTime < 10 * 60 * 1000)) {
        return cachedFreeModels;
    }

    // 기본 후보군 (openrouter/free 자동 라우터 최우선)
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
            
            // 무료 모델 필터링: :free 접미사 또는 pricing=0
            // 안전검사/오디오/이미지 전용 모델 제외하고 텍스트/챗 모델 위주 선별
            const dynamicFree = models
                .filter(m => {
                    const isFree = m.id.endsWith(':free') || (m.pricing && m.pricing.prompt === '0' && m.pricing.completion === '0');
                    const isSpecial = m.id.includes('safety') || m.id.includes('lyria') || m.id.includes('clip');
                    return isFree && !isSpecial && m.id !== 'openrouter/free';
                })
                .map(m => m.id);

            // 주요 고성능 무료 모델 우선 순위 부여
            dynamicFree.sort((a, b) => {
                const priorityOrder = ['gemma', 'nemotron', 'llama', 'deepseek', 'mistral', 'qwen', 'liquid'];
                const scoreA = priorityOrder.findIndex(p => a.includes(p));
                const scoreB = priorityOrder.findIndex(p => b.includes(p));
                return (scoreA === -1 ? 99 : scoreA) - (scoreB === -1 ? 99 : scoreB);
            });

            candidates.push(...dynamicFree.slice(0, 6));
        }
    } catch (e) {
        console.warn('[AI Models] Dynamic free models fetch failed, using fallback list:', e.message);
    }

    // 최소 안전 보장 폴백 목록
    const fallbacks = [
        'google/gemma-4-31b-it:free',
        'nvidia/nemotron-3-super-120b-a12b:free',
        'liquid/lfm-2.5-2.6b:free',
        'z-ai/glm-5.2:free'
    ];
    fallbacks.forEach(fb => {
        if (!candidates.includes(fb)) candidates.push(fb);
    });

    cachedFreeModels = candidates;
    lastCacheTime = now;
    return candidates;
}

module.exports = async (req, res) => {
    // CORS 헤더 설정
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

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        return res.status(500).json({
            error: 'Vercel 환경 변수에 OPENROUTER_API_KEY가 등록되지 않았습니다. Vercel 대시보드(Settings > Environment Variables)에서 등록해주세요.'
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

    const candidateModels = await getCandidateFreeModels(apiKey);
    let lastError = null;

    // 🔄 자동 무료 모델 순회 루프
    for (const model of candidateModels) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 9500); // 9.5초 타임아웃

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
                lastError = `Model ${model} returned ${response.status}: ${errText}`;
                console.warn(`[AI Recommend] ${model} 실패, 다음 무료 모델로 자동 폴백:`, lastError);
                continue;
            }

            const data = await response.json();
            const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
            if (!content) {
                lastError = `Model ${model} returned empty content`;
                continue;
            }

            // JSON 파싱 (마크다운 ```json ... ``` 래핑 정제)
            let jsonStr = content.trim();
            if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
            }

            const parsed = JSON.parse(jsonStr);
            if (parsed && Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
                return res.status(200).json({
                    success: true,
                    modelUsed: model,
                    basePlace: placeName,
                    recommendations: parsed.recommendations
                });
            }
        } catch (err) {
            lastError = err.message || String(err);
            console.warn(`[AI Recommend] ${model} 예외 발생, 다음 무료 모델 시도:`, lastError);
        }
    }

    return res.status(502).json({
        error: 'AI 추천을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',
        detail: lastError
    });
};
