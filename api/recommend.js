// Vercel Serverless Function: Multi-Provider Free AI Nearby Recommendations
// Providers Supported: Google Gemini API (Free 1,500/day), Groq API (Free 14,400/day), OpenRouter
// EndPoint: POST /api/recommend

let cachedOpenRouterModels = null;
let lastCacheTime = 0;

// 전체 요청은 이 예산(ms) 안에서 상위 제공자들을 시도하고, 남은 시간이 없으면
// 즉시 4번 큐레이션 폴백으로 넘어간다. 플랫폼의 함수 실행 시간 제한(Vercel Hobby
// 기본 10초)보다 확실히 짧게 잡아, 폴백에 항상 도달할 수 있도록 한다.
const TOTAL_BUDGET_MS = 8000;
const MIN_ATTEMPT_MS = 1500; // 이보다 적게 남으면 해당 제공자는 아예 시도하지 않음

function remainingMs(deadline) {
    return deadline - Date.now();
}

// 1. Google Gemini API (가장 안정적 & 고성능: 하루 1,500회 완전 무료, 초고속, 구조화 JSON 지원)
async function callGemini(apiKey, prompt, deadline) {
    const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'];
    for (const model of models) {
        const budget = remainingMs(deadline);
        if (budget < MIN_ATTEMPT_MS) break;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), Math.min(9500, budget - 200));
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey  // 헤더로 이동 (URL 쿼리 대신)
                },
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
async function callGroq(apiKey, prompt, deadline) {
    const models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
    for (const model of models) {
        const budget = remainingMs(deadline);
        if (budget < MIN_ATTEMPT_MS) break;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), Math.min(9500, budget - 200));
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
async function getOpenRouterCandidateModels(apiKey, deadline) {
    const now = Date.now();
    if (cachedOpenRouterModels && (now - lastCacheTime < 10 * 60 * 1000)) {
        return cachedOpenRouterModels;
    }

    const candidates = ['openrouter/free'];
    try {
        const budget = remainingMs(deadline);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), Math.max(500, Math.min(4000, budget - 200)));
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

async function callOpenRouter(apiKey, prompt, deadline) {
    const candidateModels = await getOpenRouterCandidateModels(apiKey, deadline);
    let lastError = null;

    for (const model of candidateModels) {
        const budget = remainingMs(deadline);
        if (budget < MIN_ATTEMPT_MS) break;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), Math.min(9500, budget - 200));

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

// 4. 오프라인 & 무료 한도 초과(429) 대비 스마트 큐레이션 폴백 엔진
function getCuratedFallbackRecommendations(placeName, city, category) {
    const pLower = (placeName || '').toLowerCase();
    const cLower = (city || '').toLowerCase();

    // 1) 오사카 (도톤보리, 난바, 우메다 등)
    if (cLower.includes('osaka') || cLower.includes('오사카') || pLower.includes('dotonbori') || pLower.includes('도톤보리') || pLower.includes('namba') || pLower.includes('난바')) {
        const pool = [
            {
                name: '킨류 라멘 도톤보리 본점',
                category: 'restaurant',
                categoryLabel: '로컬 맛집',
                distance: '도보 3분 (220m)',
                estimatedRating: 4.4,
                signatureMenu: '차슈 라멘 (900엔)',
                priceRange: '1인당 800~1,200엔',
                reason: '거대한 입체 용 간판이 상징적인 24시간 라멘집. 진하고 담백한 돼지뼈 육수에 쫄깃한 생면이 일품입니다.',
                tip: '셀프바에서 매콤한 부추무침과 김치를 무료로 듬뿍 얹어 칼칼하게 드셔보세요.'
            },
            {
                name: '쿠시카츠 다루마 도톤보리점',
                category: 'restaurant',
                categoryLabel: '로컬 맛집',
                distance: '도보 4분 (300m)',
                estimatedRating: 4.5,
                signatureMenu: '도톤보리 모둠 쿠시카츠 세트 (9종 1,600엔)',
                priceRange: '1인당 1,500~2,500엔',
                reason: '1929년 창업한 오사카 명물 꼬치튀김 전문점. 얇고 바삭한 튀김옷과 비법 간장 소스가 조화를 이룹니다.',
                tip: '양배추와 하이볼을 곁들이면 기름지지 않고 깔끔합니다. 소스는 뿌려 먹는 방식으로 위생적입니다.'
            },
            {
                name: '이치란 라멘 도톤보리점',
                category: 'restaurant',
                categoryLabel: '로컬 맛집',
                distance: '도보 5분 (350m)',
                estimatedRating: 4.6,
                signatureMenu: '천연 돈코츠 라멘',
                priceRange: '1인당 1,000~1,500엔',
                reason: '칸막이 좌석에서 오롯이 맛에 집중할 수 있는 진하고 깊은 돈코츠 라멘 전문점입니다.',
                tip: '비법 소스 3배, 면 익힘 보통, 마늘 1쪽 설정이 한국인 입맛에 가장 황금비율입니다.'
            },
            {
                name: '아라비카 교토 도톤보리점',
                category: 'cafe',
                categoryLabel: '감성 카페',
                distance: '도보 3분 (200m)',
                estimatedRating: 4.6,
                signatureMenu: '라떼 & 에스프레소',
                priceRange: '1인당 600~900엔',
                reason: '도톤보리 강변을 내려다보며 여유롭게 쉴 수 있는 스페셜티 커피 카페입니다.',
                tip: '테이크아웃해서 도톤보리 강변을 산책하며 즐기기 좋습니다.'
            },
            {
                name: '글리코 러닝맨 포토스팟',
                category: 'spot',
                categoryLabel: '주변 명소',
                distance: '도보 1분 (80m)',
                estimatedRating: 4.8,
                signatureMenu: '글리코 러너 만세 포즈 인증샷',
                priceRange: '무료',
                reason: '오사카 여행의 상징적인 명소. 에비스바시 다리에서 글리코상을 배경으로 인생샷을 남겨보세요.',
                tip: '해 질 녘 네온사인이 화려하게 켜지는 저녁 7~9시 사이에 방문하면 가장 활기차고 사진이 예쁩니다.'
            },
            {
                name: '신사이바시스지 상점가',
                category: 'spot',
                categoryLabel: '주변 명소',
                distance: '도보 3분 (250m)',
                estimatedRating: 4.6,
                signatureMenu: '아케이드 쇼핑 & 드럭스토어 투어',
                priceRange: '무료 (쇼핑 자유)',
                reason: '비가 와도 편안하게 걸을 수 있는 오사카 최대 길이의 지붕 덮인 아케이드 쇼핑 거리입니다.',
                tip: '도톤보리에서 신사이바시역 방향으로 쭉 걸어가며 로컬 패션 매장과 기념품 숍을 둘러보세요.'
            },
            {
                name: '크로스 호텔 오사카',
                category: 'hotel',
                categoryLabel: '숙소',
                distance: '도보 2분 (160m)',
                estimatedRating: 4.5,
                signatureMenu: '모던 룸 & 독립 욕조',
                priceRange: '1박 15~25만 원 선',
                reason: '도톤보리 입구 바로 앞에 위치해 밤늦게까지 야경과 식사를 즐기고 도보로 복귀하기 완벽한 숙소입니다.',
                tip: '짐 보관 서비스가 매우 친절하며, 돈키호테와 드럭스토어가 도보 1분 거리입니다.'
            }
        ];
        return filterByCategory(pool, category, placeName, '오사카');
    }

    // 2) 교토 (기온, 청수사, 아라시야마 등)
    if (cLower.includes('kyoto') || cLower.includes('교토') || pLower.includes('gion') || pLower.includes('기온') || pLower.includes('kiyomizu') || pLower.includes('청수사')) {
        const pool = [
            {
                name: '스타벅스 교토 니넨자카점',
                category: 'cafe',
                categoryLabel: '감성 카페',
                distance: '도보 5분 (350m)',
                estimatedRating: 4.7,
                signatureMenu: '말차 라떼 & 에스프레소',
                priceRange: '1인당 600~900엔',
                reason: '100년이 넘은 전통 목조 가옥을 개조한 세계 유일 다다미 좌식 스타벅스입니다.',
                tip: '2층 다다미방 좌석은 신발을 벗고 올라가 교토 고즈넉한 정취를 만끽하기에 좋습니다.'
            },
            {
                name: '아라비카 교토 히가시야마점',
                category: 'cafe',
                categoryLabel: '감성 카페',
                distance: '도보 4분 (300m)',
                estimatedRating: 4.6,
                signatureMenu: '교토 라떼',
                priceRange: '1인당 600~800엔',
                reason: '야사카 탑을 배경으로 커피 인증샷을 찍는 교토 최고의 스페셜티 커피 브랜드 본점입니다.',
                tip: '연유가 살짝 들어간 달콤 쌉싸름한 교토 라떼를 테이크아웃해 골목을 산책해보세요.'
            },
            {
                name: '멘야 이노이치',
                category: 'restaurant',
                categoryLabel: '로컬 맛집',
                distance: '도보 8분 (600m)',
                estimatedRating: 4.7,
                signatureMenu: '가쓰오 맑은 흑/백 쇼유 라멘',
                priceRange: '1인당 1,200~1,800엔',
                reason: '미슐랭 빕구르망에 등재된 최고급 가쓰오부시 맑은 육수의 담백하고 깊은 라멘 명가입니다.',
                tip: '토치로 구운 소고기 차슈와 함께 제공되는 유자 껍질을 살짝 뿌려 먹으면 풍미가 극대화됩니다.'
            },
            {
                name: '기온 탄토',
                category: 'restaurant',
                categoryLabel: '로컬 맛집',
                distance: '도보 6분 (450m)',
                estimatedRating: 4.5,
                signatureMenu: '특제 오코노미야키 & 야키소바',
                priceRange: '1인당 1,500~2,500엔',
                reason: '시라카와 운하가 보이는 창가에서 철판 요리를 맛볼 수 있는 기온 거리의 운치 있는 식당입니다.',
                tip: '창가 자리를 요청하면 버드나무와 작은 개천이 흐르는 교토 특유의 감성을 즐길 수 있습니다.'
            },
            {
                name: '산넨자카 & 니넨자카 거리',
                category: 'spot',
                categoryLabel: '주변 명소',
                distance: '도보 3분 (200m)',
                estimatedRating: 4.8,
                signatureMenu: '전통 가옥 거리 산책 & 기념품 쇼핑',
                priceRange: '무료',
                reason: '기와지붕 전통 상점과 돌담길이 이어지는 교토 최고의 정취를 자랑하는 보행자 전용 거리입니다.',
                tip: '오전 9시 이전이나 오후 5시 이후에 방문하면 붐비지 않고 고즈넉한 사진을 남길 수 있습니다.'
            },
            {
                name: '기온 료칸 카라쿠',
                category: 'hotel',
                categoryLabel: '숙소',
                distance: '도보 7분 (500m)',
                estimatedRating: 4.6,
                signatureMenu: '전통 다다미 객실 & 가이세키 석식',
                priceRange: '1박 25~45만 원 선',
                reason: '기온과 야사카 신사 인근에 위치해 교토의 전통 온천과 정갈한 일본식 환대를 경험할 수 있습니다.',
                tip: '조용한 골목에 위치해 도심 속 휴식을 취하기 좋으며 청수사까지 아침 산책이 가능합니다.'
            }
        ];
        return filterByCategory(pool, category, placeName, '교토');
    }

    // 3) 도쿄 (신주쿠, 시부야, 긴자, 아사쿠사 등)
    if (cLower.includes('tokyo') || cLower.includes('도쿄') || pLower.includes('shibuya') || pLower.includes('shinjuku') || pLower.includes('ginza')) {
        const pool = [
            {
                name: '이치란 라멘 시부야점',
                category: 'restaurant',
                categoryLabel: '로컬 맛집',
                distance: '도보 4분 (300m)',
                estimatedRating: 4.6,
                signatureMenu: '천연 돈코츠 라멘',
                priceRange: '1인당 1,000~1,500엔',
                reason: '독서실 칸막이 좌석에서 오롯이 맛에 집중할 수 있는 진하고 깊은 돈코츠 라멘의 대명사입니다.',
                tip: '비법 소스 3배, 면 익힘 보통, 마늘 1쪽 설정이 한국인 입맛에 가장 황금비율입니다.'
            },
            {
                name: '블루보틀 커피 아오야마점',
                category: 'cafe',
                categoryLabel: '감성 카페',
                distance: '도보 6분 (450m)',
                estimatedRating: 4.5,
                signatureMenu: '뉴올리언스 아이스 커피 & 와플',
                priceRange: '1인당 700~1,200엔',
                reason: '울창한 녹음이 우거진 테라스를 품은 감성적인 스페셜티 핸드드립 커피 매장입니다.',
                tip: '바람 솔솔 부는 야외 발코니 테이블에서 갓 구운 따뜻한 리에주 와플을 꼭 드셔보세요.'
            },
            {
                name: '시부야 스카이 전망대',
                category: 'spot',
                categoryLabel: '주변 명소',
                distance: '도보 3분 (250m)',
                estimatedRating: 4.8,
                signatureMenu: '루프탑 야경 & 후지산 조망',
                priceRange: '입장료 약 2,200엔',
                reason: '지상 229m 옥상에서 시부야 스크램블 교차로와 도쿄 타워 전경을 360도 파노라마로 감상할 수 있습니다.',
                tip: '일몰 30분 전 시간대로 사전 예매하면 노을과 화려한 도쿄 야경을 모두 담을 수 있습니다.'
            },
            {
                name: '호텔 그레이서리 신주쿠',
                category: 'hotel',
                categoryLabel: '숙소',
                distance: '도보 5분 (400m)',
                estimatedRating: 4.5,
                signatureMenu: '고질라 헤드 테라스 뷰 룸',
                priceRange: '1박 18~28만 원 선',
                reason: '신주쿠 카부키초 중심에 위치해 가부키초 타워와 교통이 편리하며 대형 고질라 조형물로 유명합니다.',
                tip: '호텔 8층 로비 라운지 야외 테라스에서 거대한 고질라 두상을 눈앞에서 직관할 수 있습니다.'
            }
        ];
        return filterByCategory(pool, category, placeName, '도쿄');
    }

    // 4) 일반 범용 스마트 추천 (모든 도시/국가 대상)
    const baseCity = city || '현지';
    const genericPool = [
        {
            name: `${placeName} 근처 인기 로컬 베이커리 & 브런치 카페`,
            category: 'cafe',
            categoryLabel: '감성 카페',
            distance: '도보 3분 (220m)',
            estimatedRating: 4.6,
            signatureMenu: '핸드드립 커피 & 시그니처 디저트',
            priceRange: '1인당 600~1,200엔 / 8,000~15,000원',
            reason: `${placeName} 바로 인근에서 현지 여행객들에게 호평받는 감성적이고 조용한 휴식 공간입니다.`,
            tip: '창가 테이블에서 당일 구워낸 신선한 빵과 시그니처 음료를 즐기며 여유를 만끽해 보세요.'
        },
        {
            name: `${baseCity} 전통 명물 전문 식당`,
            category: 'restaurant',
            categoryLabel: '로컬 맛집',
            distance: '도보 5분 (350m)',
            estimatedRating: 4.7,
            signatureMenu: '셰프 추천 대표 세트 메뉴',
            priceRange: '1인당 1,200~2,500엔 / 15,000~25,000원',
            reason: `${placeName} 방문 후 도보로 들르기 가장 좋은 ${baseCity} 정통 로컬 미식 전문점입니다.`,
            tip: '점심 피크 타임(12:00~13:30)을 살짝 피해 방문하시면 웨이팅 없이 편안하게 식사할 수 있습니다.'
        },
        {
            name: `${placeName} 인근 역사 문화 산책로 & 포토존`,
            category: 'spot',
            categoryLabel: '주변 명소',
            distance: '도보 4분 (300m)',
            estimatedRating: 4.8,
            signatureMenu: '도심 경관 전망 & 인생샷 스팟',
            priceRange: '무료',
            reason: `${placeName}과 함께 묶어서 도보로 산책하기 좋은 ${baseCity}의 낭만적인 포토 스팟입니다.`,
            tip: '오후 해 질 녘 골든아워에 방문하면 빛이 좋아 가장 아름다운 사진을 담을 수 있습니다.'
        },
        {
            name: `${placeName} 도보권 모던 부티크 호텔`,
            category: 'hotel',
            categoryLabel: '숙소',
            distance: '도보 4분 (280m)',
            estimatedRating: 4.5,
            signatureMenu: '스탠다드 더블 & 프리미엄 조식',
            priceRange: '1박 10~20만 원 선',
            reason: `${placeName} 주변 대중교통 및 쇼핑가 접근성이 탁월하여 여행 피로를 최소화할 수 있습니다.`,
            tip: '체크인 전/후 무료 짐 보관 서비스를 이용하면 가벼운 몸으로 주변을 탐방하기 좋습니다.'
        }
    ];

    return filterByCategory(genericPool, category, placeName, baseCity);
}

function filterByCategory(items, category, placeName, cityName) {
    if (!category || category === 'all') {
        return items.slice(0, 6);
    }
    const filtered = items.filter(it => it.category === category);
    if (filtered.length >= 2) {
        return filtered;
    }
    // 카테고리 항목이 적으면 보충
    const categoryLabels = {
        restaurant: '로컬 맛집',
        cafe: '감성 카페',
        hotel: '숙소',
        spot: '주변 명소'
    };
    const cLabel = categoryLabels[category] || '추천 스팟';
    const supplement = [
        ...filtered,
        {
            name: `${placeName} 인근 ${cLabel} 추천 1호점`,
            category: category,
            categoryLabel: cLabel,
            distance: '도보 4분 (280m)',
            estimatedRating: 4.6,
            signatureMenu: `${cLabel} 시그니처 대표 메뉴`,
            priceRange: '합리적인 로컬 가격대',
            reason: `${cityName} ${placeName} 인근에서 현지인들과 여행자들의 만족도가 가장 높은 곳입니다.`,
            tip: '사전 방문객 리뷰를 참고하시고 피크 시간대를 피해 여유롭게 방문해 보세요.'
        },
        {
            name: `${placeName} 도보 5분거리 숨은 ${cLabel}`,
            category: category,
            categoryLabel: cLabel,
            distance: '도보 6분 (420m)',
            estimatedRating: 4.5,
            signatureMenu: `특제 핸드메이드 메뉴 & 서비스`,
            priceRange: '가성비 우수',
            reason: `북적이지 않고 고즈넉한 분위기에서 편안하게 머무를 수 있는 히든 스팟입니다.`,
            tip: '현지 통화 또는 모바일 결제가 원활하게 지원됩니다.'
        }
    ];
    return supplement.slice(0, 5);
}

const ALLOWED_ORIGINS = new Set([
    'https://triptic-ten.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'capacitor://localhost'
]);

// 인스턴스 단위 간이 레이트리밋 (콜드 스타트마다 초기화되어 완전한 방어는 아니지만,
// 무료 LLM 쿼터를 타인이 스크립트로 순식간에 소진하는 것은 억제한다)
const recommendHits = new Map();
function isRateLimited(ip, limit = 20, windowMs = 60_000) {
    const now = Date.now();
    const rec = recommendHits.get(ip);
    if (!rec || now - rec.start > windowMs) {
        recommendHits.set(ip, { start: now, count: 1 });
        return false;
    }
    rec.count += 1;
    return rec.count > limit;
}

const CATEGORIES = new Set(['all', 'restaurant', 'cafe', 'hotel', 'spot']);

// 제어 문자를 제거하고 길이를 제한해, 프롬프트 인젝션 표면과 과도한 토큰 사용을 억제한다.
function sanitizeInput(value, maxLen) {
    if (typeof value !== 'string') return '';
    return value.replace(/[\r\n\u0000-\u001f]/g, ' ').trim().slice(0, maxLen);
}

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (origin && ALLOWED_ORIGINS.has(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
    if (isRateLimited(ip)) {
        return res.status(429).json({ error: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;
    const openrouterKey = process.env.OPENROUTER_API_KEY;

    const placeName = sanitizeInput(req.body?.placeName, 100);
    const city = sanitizeInput(req.body?.city, 60);
    const category = CATEGORIES.has(req.body?.category) ? req.body.category : 'all';

    if (!placeName) {
        return res.status(400).json({ error: '기준 장소 이름(placeName)이 필요합니다.' });
    }

    const deadline = Date.now() + TOTAL_BUDGET_MS;
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

    // 1. Google Gemini API (하루 1,500회 무료, 최고 품질)
    if (geminiKey && remainingMs(deadline) >= MIN_ATTEMPT_MS) {
        try {
            const result = await callGemini(geminiKey, prompt, deadline);
            if (result && result.recommendations && result.recommendations.length > 0) {
                return res.status(200).json({
                    success: true,
                    provider: result.provider,
                    modelUsed: result.modelUsed,
                    basePlace: placeName,
                    recommendations: result.recommendations
                });
            }
        } catch (e) {
            console.warn('[Gemini Call Error]:', e);
        }
    }

    // 2. Groq Cloud API (초고속 LPU)
    if (groqKey && remainingMs(deadline) >= MIN_ATTEMPT_MS) {
        try {
            const result = await callGroq(groqKey, prompt, deadline);
            if (result && result.recommendations && result.recommendations.length > 0) {
                return res.status(200).json({
                    success: true,
                    provider: result.provider,
                    modelUsed: result.modelUsed,
                    basePlace: placeName,
                    recommendations: result.recommendations
                });
            }
        } catch (e) {
            console.warn('[Groq Call Error]:', e);
        }
    }

    // 3. OpenRouter API
    if (openrouterKey && remainingMs(deadline) >= MIN_ATTEMPT_MS) {
        try {
            const result = await callOpenRouter(openrouterKey, prompt, deadline);
            if (result && result.recommendations && result.recommendations.length > 0) {
                return res.status(200).json({
                    success: true,
                    provider: result.provider,
                    modelUsed: result.modelUsed,
                    basePlace: placeName,
                    recommendations: result.recommendations
                });
            }
        } catch (e) {
            console.warn('[OpenRouter Call Error]:', e);
        }
    }

    // 4. 폴백: 스마트 큐레이션 엔진 (API 키 없거나 네트워크 오류 시 무중단 지원)
    const curatedRecs = getCuratedFallbackRecommendations(placeName, city, category);
    return res.status(200).json({
        success: true,
        provider: 'Triptic Curated',
        modelUsed: 'curated-recommendations',
        isFallback: true,
        basePlace: placeName,
        recommendations: curatedRecs
    });
}
