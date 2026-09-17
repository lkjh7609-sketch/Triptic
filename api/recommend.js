// Vercel Serverless Function: OpenRouter Free AI Nearby Recommendations
// EndPoint: POST /api/recommend

const FREE_MODELS = [
    'google/gemini-2.0-flash-lite:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'deepseek/deepseek-r1:free',
    'mistralai/mistral-small-3.1-24b-instruct:free',
    'qwen/qwen-2.5-72b-instruct:free'
];

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

    let lastError = null;

    // 🔄 무료 모델 자동 폴백(Fallback) 루프
    for (const model of FREE_MODELS) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 9500); // 9.5초 타임아웃

            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': 'https://triptic.vercel.app',
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
                console.warn(`[AI Recommend] ${model} 실패, 다음 모델로 폴백 시도:`, lastError);
                continue; // 다음 무료 모델로 시도
            }

            const data = await response.json();
            const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
            if (!content) {
                lastError = `Model ${model} returned empty content`;
                continue;
            }

            // JSON 파싱 (혹시 마크다운 ```json ... ``` 래핑되어 있을 경우 정제)
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
            console.warn(`[AI Recommend] ${model} 예외 발생, 다음 모델 시도:`, lastError);
        }
    }

    return res.status(502).json({
        error: 'OpenRouter 무료 모델 호출에 실패했습니다. 잠시 후 다시 시도해주세요.',
        detail: lastError
    });
};
