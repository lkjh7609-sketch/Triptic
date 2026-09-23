import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const TOTAL_BUDGET_MS = 8000;
const MIN_ATTEMPT_MS = 2500;

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
let supabase = null;
if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
}

function remainingMs(deadline) {
    return Math.max(0, deadline - Date.now());
}

async function callDeepSeek(apiKey, prompt, deadline) {
    const start = Date.now();
    const timeout = remainingMs(deadline);
    if (timeout < MIN_ATTEMPT_MS) throw new Error('Not enough time for DeepSeek attempt');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
        const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: 'You are an expert travel assistant. Output ONLY valid JSON.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                response_format: { type: "json_object" }
            }),
            signal: controller.signal
        });

        clearTimeout(timer);
        if (!res.ok) throw new Error(`DeepSeek HTTP error ${res.status}`);

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || '';
        let parsed;
        try {
            parsed = JSON.parse(content);
        } catch {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
        }

        if (parsed && Array.isArray(parsed.recommendations)) {
            return {
                recommendations: parsed.recommendations,
                provider: 'DeepSeek',
                modelUsed: data.model || 'deepseek-chat'
            };
        }
        throw new Error('DeepSeek returned invalid JSON structure');
    } catch (e) {
        clearTimeout(timer);
        throw e;
    }
}

function getCuratedFallbackRecommendations(placeName, city, category) {
    // 1) 입력된 placeName/city 문자열 기반 매칭 로직 (이전과 동일하게 유지)
    const text = (placeName + ' ' + city).toLowerCase();
    let matchedCity = 'unknown';
    
    if (text.includes('오사카') || text.includes('osaka') || text.includes('도톤보리') || text.includes('우메다')) matchedCity = 'osaka';
    else if (text.includes('도쿄') || text.includes('tokyo') || text.includes('시부야') || text.includes('신주쿠')) matchedCity = 'tokyo';
    else if (text.includes('후쿠오카') || text.includes('fukuoka') || text.includes('하카타') || text.includes('텐진')) matchedCity = 'fukuoka';
    else if (text.includes('교토') || text.includes('kyoto') || text.includes('청수사') || text.includes('아라시야마')) matchedCity = 'kyoto';
    else if (text.includes('삿포로') || text.includes('sapporo') || text.includes('스스키노')) matchedCity = 'sapporo';

    // 도시별 데이터가 없거나 unknown이면 공통 모듈 제공
    if (matchedCity === 'unknown') {
        const fallback = [
            {
                name: "현지 로컬 맛집",
                category: "restaurant",
                categoryLabel: "로컬 맛집",
                distance: "도보 5분 (400m)",
                estimatedRating: 4.5,
                signatureMenu: "현지 특선 요리",
                priceRange: "1,500~3,000엔",
                reason: "구글 평점 4.5 이상의 현지인들이 자주 찾는 검증된 로컬 식당입니다.",
                tip: "식사 시간에는 웨이팅이 있을 수 있으니 조금 서두르시는 것을 추천합니다."
            },
            {
                name: "분위기 좋은 카페",
                category: "cafe",
                categoryLabel: "감성 카페",
                distance: "도보 3분 (250m)",
                estimatedRating: 4.7,
                signatureMenu: "시그니처 디저트 & 커피",
                priceRange: "800~1,500엔",
                reason: "많이 걸은 후 잠시 쉬어가기 좋은 차분하고 예쁜 인테리어의 카페입니다.",
                tip: "창가 자리에 앉아 여유로운 시간을 보내기 좋습니다."
            },
            {
                name: "주변 산책 명소",
                category: "spot",
                categoryLabel: "주변 명소",
                distance: "도보 10분 이내",
                estimatedRating: 4.4,
                signatureMenu: "가벼운 산책 코스",
                priceRange: "무료",
                reason: "식사나 휴식 후 가볍게 걸으며 현지 풍경을 즐길 수 있는 산책로입니다.",
                tip: "해 질 무렵 방문하면 멋진 노을을 볼 수 있습니다."
            }
        ];
        return fallback;
    }

    const cityData = {
        osaka: {
            restaurant: [
                { name: "킨류 라멘 도톤보리 본점", category: "restaurant", categoryLabel: "로컬 맛집", distance: "도보 3분 (220m)", estimatedRating: 4.4, signatureMenu: "차슈 라멘 (900엔)", priceRange: "1인당 800~1,200엔", reason: "거대한 입체 용 간판이 인상적인 오사카의 상징적인 라멘집입니다. 야외 평상에 앉아 오사카의 밤공기를 마시며 먹는 라멘은 특별한 분위기를 자아냅니다.", tip: "셀프바에서 매콤한 부추무침과 다진 마늘, 김치를 듬뿍 얹어 먹는 것이 현지식 꿀팁입니다. 24시간 영업하여 야식으로 제격입니다." },
                { name: "모토무라 규카츠 난바점", category: "restaurant", categoryLabel: "맛집", distance: "도보 5분 (400m)", estimatedRating: 4.8, signatureMenu: "규카츠 정식 (1,600엔~)", priceRange: "1,500~2,500엔", reason: "개인용 미니 화로에 원하는 굽기로 직접 구워 먹는 재미와 입에서 살살 녹는 부드러운 소고기의 맛이 일품입니다.", tip: "항상 웨이팅이 길기 때문에 식사 시간대를 피해서 (오후 3~4시경) 방문하는 것을 강력히 추천합니다." }
            ],
            cafe: [
                { name: "오사카 나카자키초 카페거리", category: "cafe", categoryLabel: "감성 카페", distance: "전철 15분", estimatedRating: 4.6, signatureMenu: "핸드드립 커피 & 수제 디저트", priceRange: "1,000~2,000엔", reason: "도심 속에서 시간이 멈춘 듯한 낡은 목조 주택들을 개조한 레트로 감성의 작은 카페들이 모여있는 곳입니다.", tip: "특정 카페를 정해두기보다, 골목을 거닐다 마음에 드는 아담한 카페에 즉흥적으로 들어가보는 것이 좋습니다." }
            ],
            spot: [
                { name: "우메다 스카이빌딩 공중정원", category: "spot", categoryLabel: "야경 명소", distance: "전철 10분 + 도보 10분", estimatedRating: 4.7, signatureMenu: "360도 파노라마 야경", priceRange: "입장료 1,500엔 (오사카 주유패스 무료/할인)", reason: "우주선 모양의 독특한 건축물 꼭대기에서 오사카 도심을 360도로 조망할 수 있는 최고의 야경 스팟입니다.", tip: "해 지기 30분 전에 올라가서 일몰과 화려한 야경을 모두 감상하는 것이 가장 좋습니다." },
                { name: "아베노 하루카스 300", category: "spot", categoryLabel: "야경 명소", distance: "전철 15분", estimatedRating: 4.8, signatureMenu: "일본 최고층 빌딩 전망대", priceRange: "입장료 1,500엔", reason: "일본에서 가장 높은 빌딩으로, 통유리를 통해 발밑으로 펼쳐지는 압도적이고 탁 트인 오사카의 스카이라인을 볼 수 있습니다.", tip: "58층 야외 테라스 카페에서 오사카 시내를 내려다보며 여유롭게 맥주나 커피를 즐겨보세요." }
            ]
        },
        tokyo: {
            restaurant: [
                { name: "이치란 시부야점", category: "restaurant", categoryLabel: "로컬 맛집", distance: "도보 5분", estimatedRating: 4.5, signatureMenu: "천연 돈코츠 라멘 (980엔)", priceRange: "1,000~1,500엔", reason: "독서실 형태의 1인석에서 주변 시선 없이 오로지 라멘 맛에만 집중할 수 있는 독특한 경험을 제공합니다. 진하고 깊은 돼지뼈 육수가 일품입니다.", tip: "주문 용지에서 '비밀 소스(기본 3~5배 추천)', '마늘(1쪽)', '면 익힘 정도(질김)'를 취향껏 조절해 보세요." },
                { name: "츠지한 니혼바시 본점", category: "restaurant", categoryLabel: "해산물 맛집", distance: "전철 15분", estimatedRating: 4.7, signatureMenu: "제이타쿠돈 (카이센돈, 1,250엔~)", priceRange: "1,500~3,000엔", reason: "산처럼 쌓아주는 신선한 해산물 덮밥의 압도적인 비주얼과 맛으로 유명합니다. 마지막에 부어주는 도미 육수(도미차즈케)가 화룡점정입니다.", tip: "식사 막바지에 밥이 조금 남았을 때 셰프에게 도미 육수를 요청하고, 남겨둔 참깨 소스 회 두 점을 곁들여 드세요." }
            ],
            cafe: [
                { name: "푸글렌 도쿄 (Fuglen Tokyo)", category: "cafe", categoryLabel: "감성 카페", distance: "도보 10분 (요요기 공원 근처)", estimatedRating: 4.5, signatureMenu: "라떼 & 노르웨이식 페이스트리", priceRange: "600~1,200엔", reason: "노르웨이 오슬로의 유명 커피 브랜드의 도쿄 지점으로, 북유럽 특유의 빈티지한 인테리어와 산미 있는 수준 높은 커피를 제공합니다.", tip: "요요기 공원과 가까우니 날씨가 좋다면 커피를 테이크아웃하여 공원을 산책하는 것을 추천합니다." }
            ],
            spot: [
                { name: "시부야 스카이 (Shibuya Sky)", category: "spot", categoryLabel: "주변 명소", distance: "도보 10분", estimatedRating: 4.8, signatureMenu: "루프탑 파노라마 뷰", priceRange: "입장료 2,200엔 (사전예약 2,000엔)", reason: "시부야 스크램블 교차로를 비롯해 도쿄 도심을 229m 높이의 탁 트인 야외 옥상에서 360도로 내려다볼 수 있는 현재 도쿄 최고의 핫플레이스입니다.", tip: "일몰 시간대는 티켓이 매우 빨리 매진되므로 최소 2주~1달 전 사전 온라인 예약이 필수입니다. 옥상 에스컬레이터 샷이 포토존입니다." }
            ]
        },
        fukuoka: {
            restaurant: [
                { name: "모츠나베 오오야마 본점", category: "restaurant", categoryLabel: "로컬 맛집", distance: "도보 10분", estimatedRating: 4.6, signatureMenu: "된장(미소) 모츠나베 (1,980엔~)", priceRange: "2,000~4,000엔", reason: "진하고 고소한 미소(된장) 베이스 국물과 입에서 녹는 쫄깃하고 통통한 곱창의 조화가 후쿠오카 최고 수준입니다.", tip: "국물이 진해질 무렵 짬뽕면을 추가해서 끓여 먹는 것이 필수 코스입니다." },
                { name: "신신라멘 본점", category: "restaurant", categoryLabel: "현지 라멘", distance: "도보 5분 (텐진)", estimatedRating: 4.5, signatureMenu: "돈코츠 라멘 (760엔)", priceRange: "800~1,500엔", reason: "기존 돈코츠 라멘 특유의 돼지 냄새를 억제하여 깔끔하고 담백하면서도 깊은 감칠맛을 내어, 돈코츠 초심자도 맛있게 즐길 수 있습니다.", tip: "늦은 밤(새벽 3시까지 영업) 야식으로 볶음밥(야키메시)과 교자를 세트로 곁들여 먹는 것을 추천합니다." }
            ],
            spot: [
                { name: "나카스 포장마차 거리", category: "spot", categoryLabel: "주변 명소", distance: "도보 15분", estimatedRating: 4.2, signatureMenu: "야키토리, 명란계란말이, 오뎅", priceRange: "1,500~3,000엔", reason: "강변을 따라 늘어선 야타이(포장마차)에서 강바람을 맞으며 현지인들과 어깨를 부딪히며 술잔을 기울이는 후쿠오카 특유의 낭만을 느낄 수 있습니다.", tip: "메뉴판 가격이 명확한 곳(명세서 제공 여부 등)을 미리 검색해보고 들어가시는 것이 좋으며, 현금 결제만 가능할 수 있습니다." }
            ]
        },
        kyoto: {
            restaurant: [
                { name: "카츠쿠라 본점", category: "restaurant", categoryLabel: "맛집", distance: "전철 15분 (가와라마치)", estimatedRating: 4.6, signatureMenu: "명품 흑돼지 돈카츠", priceRange: "2,000~3,000엔", reason: "교토에서 시작된 프리미엄 돈카츠 전문점으로, 두툼하고 육즙 가득한 고기와 바삭한 튀김옷의 밸런스가 훌륭합니다.", tip: "직접 깨를 갈아서 소스를 만들어 먹는 재미가 있으며, 밥, 장국, 양배추는 무한 리필이 가능합니다." }
            ],
            spot: [
                { name: "기온 거리 (하나미코지)", category: "spot", categoryLabel: "주변 명소", distance: "도보 20분", estimatedRating: 4.5, signatureMenu: "전통 가옥 거리 산책", priceRange: "무료", reason: "수백 년 된 전통 목조 가옥들이 보존되어 있어 교토 특유의 고즈넉한 정취를 가장 잘 느낄 수 있는 거리입니다. 운이 좋으면 진짜 게이샤나 마이코를 볼 수도 있습니다.", tip: "해 질 무렵 가스등에 불이 켜질 때 방문하면 분위기가 가장 좋지만, 사유지 내 사진 촬영 금지 구역을 반드시 지켜야 합니다." }
            ]
        },
        sapporo: {
            restaurant: [
                { name: "다루마 본점 (징기스칸)", category: "restaurant", categoryLabel: "로컬 맛집", distance: "도보 10분 (스스키노)", estimatedRating: 4.7, signatureMenu: "징기스칸 양고기 구이", priceRange: "3,000~5,000엔", reason: "양고기 특유의 누린내가 전혀 없는 신선한 생 양고기를 참숯 화로에 구워 먹는, 삿포로에 오면 무조건 먹어야 하는 소울 푸드입니다.", tip: "항상 대기가 길고 매장 내부가 좁아 옷에 고기 냄새가 많이 밸 수 있으니 유의하세요. 고기를 다 먹은 후 남은 소스에 자스민 차를 부어 마시는 것이 별미입니다." },
                { name: "스아게 플러스 (Suage+)", category: "restaurant", categoryLabel: "맛집", distance: "도보 5분", estimatedRating: 4.6, signatureMenu: "스프카레 (1,200엔~)", priceRange: "1,500~2,500엔", reason: "걸쭉한 일본 카레와 달리 국물처럼 떠먹는 삿포로식 스프카레의 원조격 맛집입니다. 큼직하게 튀겨 넣은 홋카이도산 야채의 단맛이 환상적입니다.", tip: "브로콜리 튀김 토핑을 반드시 추가하세요. 고기보다 브로콜리가 더 맛있다고 극찬하는 사람들이 많습니다." }
            ],
            spot: [
                { name: "오도리 공원 & TV타워", category: "spot", categoryLabel: "주변 명소", distance: "도보 5분", estimatedRating: 4.4, signatureMenu: "도심 속 공원 산책 & 옥수수 구이", priceRange: "공원 무료, 타워 전망대 1,000엔", reason: "삿포로 도심 한가운데를 길게 가로지르는 아름다운 공원으로, 계절마다 눈축제, 맥주축제 등 다양한 이벤트가 열립니다.", tip: "여름철에 방문한다면 공원 내 명물 포장마차에서 파는 구운 옥수수(야키토우키비)를 꼭 맛보세요." }
            ]
        }
    };

    const target = cityData[matchedCity];
    let supplement = [];
    if (category && category !== 'all' && target[category]) {
        supplement = target[category];
    } else {
        supplement = [
            ...(target.restaurant || []),
            ...(target.spot || []),
            ...(target.cafe || [])
        ];
    }
    
    // Sort by rating
    supplement.sort((a, b) => b.estimatedRating - a.estimatedRating);
    if (supplement.length === 0) {
        return getCuratedFallbackRecommendations('fallback', 'unknown', 'all');
    }
    return supplement.slice(0, 5);
}

const ALLOWED_ORIGINS = new Set([
    'https://triptic.my',
    'https://www.triptic.my',
    'https://triptic-ten.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'capacitor://localhost'
]);

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

const CATEGORIES = new Set(['all', 'restaurant', 'cafe', 'culture', 'spot']);

async function enrichWithGoogleMaps(recs, apiKey, city) {
    if (!apiKey) return recs;
    const promises = recs.map(async (r) => {
        try {
            const query = `${city} ${r.name}`;
            const queryKey = query.trim().toLowerCase();
            
            // Check cache first if supabase is available
            if (supabase) {
                const { data: cacheData } = await supabase
                    .from('place_cache')
                    .select('*')
                    .eq('query_key', queryKey)
                    .single();
                
                if (cacheData) {
                    r.placeId = cacheData.place_id;
                    r.lat = cacheData.lat;
                    r.lng = cacheData.lng;
                    r.address = cacheData.address;
                    return r;
                }
            }
            
            const encodedQuery = encodeURIComponent(query);
            const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodedQuery}&inputtype=textquery&fields=place_id,geometry,formatted_address&key=${apiKey}`;
            const res = await fetch(url);
            const data = await res.json();
            
            if (data.status === "OK" && data.candidates && data.candidates.length > 0) {
                const first = data.candidates[0];
                r.placeId = first.place_id;
                r.lat = first.geometry.location.lat;
                r.lng = first.geometry.location.lng;
                r.address = first.formatted_address;
                
                // Save to cache
                if (supabase) {
                    await supabase.from('place_cache').upsert({
                        query_key: queryKey,
                        place_id: r.placeId,
                        lat: r.lat,
                        lng: r.lng,
                        address: r.address
                    }).catch(e => console.warn('Cache insert error', e));
                }
            }
        } catch (e) { console.warn("Google Maps Enrich Error", e); }
        return r;
    });
    return await Promise.all(promises);
}

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
        return res.status(200).end();
    }
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
    if (isRateLimited(ip)) {
        return res.status(429).json({ error: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' });
    }

    const deepseekKey = process.env.DEEPSEEK_API_KEY;

    const placeName = sanitizeInput(req.body?.placeName, 100);
    const city = sanitizeInput(req.body?.city, 60);
    const category = CATEGORIES.has(req.body?.category) ? req.body.category : 'all';

    if (!placeName) {
        return res.status(400).json({ error: '기준 장소 이름(placeName)이 필요합니다.' });
    }

    if (process.env.SUPABASE_SERVICE_ROLE_KEY && supabase) {
        try {
            const { data: cacheHit } = await supabase
                .from('ai_recommendation_cache')
                .select('recommendations, provider, model_used')
                .eq('city', city)
                .eq('category', category)
                .ilike('place_name', placeName)
                .single();
            
            if (cacheHit && cacheHit.recommendations) {
                const googleApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
                const enrichedHit = await enrichWithGoogleMaps(cacheHit.recommendations, googleApiKey, city);
                return res.status(200).json({
                    success: true,
                    recommendations: enrichedHit,
                    provider: cacheHit.provider,
                    modelUsed: cacheHit.model_used,
                    cached: true
                });
            }
        } catch (e) {
            console.warn('[Cache] 읽기 실패:', e.message);
        }
    }

    const deadline = Date.now() + TOTAL_BUDGET_MS;
    const locationContext = city ? `${city}의 '${placeName}'` : `'${placeName}'`;
    
    // EXPLICITLY TELL DEEPSEEK NO HOTELS
    const categoryFocus = category && category !== 'all' 
        ? `특히 [${category}] 분야에 집중해서` 
        : '식사, 감성 카페, 볼거리 명소를 골고루 추천하되, 숙소(호텔 등)는 절대로 제외하고';

    const prompt = `
당신은 현지 지리에 정통한 전문 여행 가이드입니다.
${locationContext} 주변에서 여행객이 실제로 도보나 대중교통으로 가기 좋은 장소 4~6곳을 추천해주세요.
${categoryFocus} 엄선해 주세요.

반드시 아래 JSON 형식으로만 응답해야 하며, 마크다운 코드블록이나 다른 설명 없이 순수 JSON만 출력하세요:
{
  "recommendations": [
    {
      "name": "정확한 상호명 및 한국어 명칭 (예: 앗치치혼포 도톤보리 본점)",
      "category": "restaurant | cafe | spot",
      "categoryLabel": "로컬 맛집 | 감성 카페 | 주변 명소",
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

    if (deepseekKey && remainingMs(deadline) >= MIN_ATTEMPT_MS) {
        try {
            const result = await callDeepSeek(deepseekKey, prompt, deadline);
            if (result && result.recommendations && result.recommendations.length > 0) {
                const googleApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
                const enrichedDeepseek = await enrichWithGoogleMaps(result.recommendations, googleApiKey, city);
                return res.status(200).json({
                    success: true,
                    provider: result.provider,
                    modelUsed: result.modelUsed,
                    basePlace: placeName,
                    recommendations: enrichedDeepseek
                });
            }
        } catch (e) {
            console.warn('[DeepSeek Call Error]:', e);
        }
    }

    const curatedRecs = getCuratedFallbackRecommendations(placeName, city, category);
    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    const enrichedCurated = await enrichWithGoogleMaps(curatedRecs, googleApiKey, city);
    return res.status(200).json({
        success: true,
        provider: 'Triptic Curated',
        modelUsed: 'curated-recommendations',
        isFallback: true,
        basePlace: placeName,
        recommendations: enrichedCurated
    });
}
