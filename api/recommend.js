// Vercel Serverless Function: AI 주변 장소 추천
// Endpoint: POST /api/recommend { placeName, city, category?, locale?, lat?, lng? }
//
// 1) ai_recommendation_cache(90일) 조회 → 2) LLM(OpenRouter 경유 DeepSeek, 없으면
// DeepSeek 직접) → 3) locale이 ko면 큐레이션 폴백.
//
// 좌표: 앱의 Google Maps 키는 HTTP 리퍼러 제한이 걸린 브라우저 키라 서버에서 Places
// 웹 서비스를 부를 수 없다("API keys with referer restrictions cannot be used"). 그래서
// 기본적으로 좌표는 클라이언트(Maps JS PlacesService)가 붙인다. IP 제한 서버 키를
// GOOGLE_PLACES_SERVER_KEY로 따로 등록하면 서버가 미리 붙이고 place_cache에 저장한다.
import { applyCors, createRateLimiter, sanitizeInput, normalizeKey, parseLocale, LOCALE_LANGUAGE_NAME } from './_lib/http.js';
import { chatCompletion, hasLlmProvider, parseJsonObject } from './_lib/llm.js';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';

// DeepSeek가 추천 5개를 JSON으로 쓰는 데 10~20초가 걸린다. vercel.json maxDuration(30초) 안에서
// Google Places 보강 시간까지 남겨둔다.
const LLM_TIMEOUT_MS = 22000;
const CACHE_TTL_DAYS = 90;
const CATEGORIES = new Set(['all', 'restaurant', 'cafe', 'culture', 'spot']);
const isRateLimited = createRateLimiter(20);

/**
 * LLM을 쓸 수 없을 때의 한국어 큐레이션 폴백(주요 일본 5개 도시). 실제 존재하는 장소만
 * 담는다. 한국어 데이터라 locale이 ko일 때만 쓴다.
 */
function getCuratedFallbackRecommendations(placeName, city, category) {
    const text = (placeName + ' ' + city).toLowerCase();
    let matchedCity = 'unknown';
    
    if (text.includes('오사카') || text.includes('osaka') || text.includes('도톤보리') || text.includes('우메다')) matchedCity = 'osaka';
    else if (text.includes('도쿄') || text.includes('tokyo') || text.includes('시부야') || text.includes('신주쿠')) matchedCity = 'tokyo';
    else if (text.includes('후쿠오카') || text.includes('fukuoka') || text.includes('하카타') || text.includes('텐진')) matchedCity = 'fukuoka';
    else if (text.includes('교토') || text.includes('kyoto') || text.includes('청수사') || text.includes('아라시야마')) matchedCity = 'kyoto';
    else if (text.includes('삿포로') || text.includes('sapporo') || text.includes('스스키노')) matchedCity = 'sapporo';

    // 매칭되는 도시가 없으면 폴백하지 않는다 — 존재하지 않는 가상의 장소("현지 로컬 맛집")를
    // 보여주면 사용자가 실제 일정에 넣었을 때 엉뚱한 좌표가 붙는다.
    if (matchedCity === 'unknown') return [];

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
    // distance/estimatedRating은 특정 기준점 없이 적어둔 값이라 내보내지 않는다 —
    // 실제 거리는 클라이언트가 기준 장소와 Google 좌표로 계산한다.
    return supplement.slice(0, 5).map((rec) => {
        const rest = { ...rec };
        delete rest.distance;
        delete rest.estimatedRating;
        return rest;
    });
}

function buildPrompt({ placeName, city, category, locale }) {
    const locationContext = city ? `"${placeName}" in ${city}` : `"${placeName}"`;
    const focus = category !== 'all'
        ? `Focus on the "${category}" category.`
        : 'Mix restaurants, cafes, and sights. Never include hotels or other lodging.';
    return `You are a travel guide who knows the area well.
Recommend 5 real places near ${locationContext} that a traveler can easily reach on foot or by public transit.
${focus}
Do not include "${placeName}" itself. Only recommend places that actually exist, using their exact official names so they can be found on Google Maps.
Write every text field in ${LOCALE_LANGUAGE_NAME[locale]}.

Respond with JSON only, in this shape:
{
  "recommendations": [
    {
      "name": "exact official place name",
      "category": "restaurant | cafe | culture | spot",
      "categoryLabel": "short category label",
      "signatureMenu": "signature dish or highlight",
      "priceRange": "typical price range",
      "reason": "one or two short sentences on why it is worth visiting",
      "tip": "one short practical visiting tip"
    }
  ]
}`;
}

const VALID_REC_CATEGORIES = new Set(['restaurant', 'cafe', 'culture', 'spot']);

function sanitizeRecommendations(list, placeName) {
    if (!Array.isArray(list)) return [];
    const baseKey = normalizeKey(placeName);
    return list
        .filter((r) => r && typeof r.name === 'string' && r.name.trim() && normalizeKey(r.name) !== baseKey)
        .slice(0, 6)
        .map((r) => ({
            name: String(r.name).trim().slice(0, 120),
            category: VALID_REC_CATEGORIES.has(r.category) ? r.category : 'spot',
            categoryLabel: typeof r.categoryLabel === 'string' ? r.categoryLabel.slice(0, 40) : '',
            signatureMenu: typeof r.signatureMenu === 'string' ? r.signatureMenu.slice(0, 120) : '',
            priceRange: typeof r.priceRange === 'string' ? r.priceRange.slice(0, 60) : '',
            reason: typeof r.reason === 'string' ? r.reason.slice(0, 400) : '',
            tip: typeof r.tip === 'string' ? r.tip.slice(0, 300) : '',
        }));
}

/** 추천 장소에 Google Places 실제 좌표/주소를 붙인다(place_cache로 중복 호출 절약) */
async function enrichWithGoogleMaps(recs, city, bias) {
    const apiKey = process.env.GOOGLE_PLACES_SERVER_KEY;
    if (!apiKey) return recs;
    const db = supabaseAdmin();

    return Promise.all(recs.map(async (rec) => {
        const r = { ...rec };
        try {
            const query = city ? `${r.name} ${city}` : r.name;
            const queryKey = normalizeKey(query);

            if (db) {
                const { data: cached } = await db
                    .from('place_cache')
                    .select('place_id, lat, lng, address')
                    .eq('query_key', queryKey)
                    .maybeSingle();
                if (cached && cached.lat != null && cached.lng != null) {
                    return { ...r, placeId: cached.place_id, lat: cached.lat, lng: cached.lng, address: cached.address };
                }
            }

            const params = new URLSearchParams({
                input: query,
                inputtype: 'textquery',
                fields: 'place_id,geometry,formatted_address',
                key: apiKey,
            });
            if (bias) params.set('locationbias', `circle:3000@${bias.lat},${bias.lng}`);
            const res = await fetch(`https://maps.googleapis.com/maps/api/place/findplacefromtext/json?${params}`);
            const data = await res.json();
            const first = data.status === 'OK' ? data.candidates?.[0] : null;
            if (!first?.geometry?.location) return r;

            const enriched = {
                ...r,
                placeId: first.place_id,
                lat: first.geometry.location.lat,
                lng: first.geometry.location.lng,
                address: first.formatted_address,
            };
            if (db) {
                const { error } = await db.from('place_cache').upsert({
                    query_key: queryKey,
                    place_id: enriched.placeId,
                    lat: enriched.lat,
                    lng: enriched.lng,
                    address: enriched.address,
                });
                if (error) console.warn('[recommend] place_cache upsert failed:', error.message);
            }
            return enriched;
        } catch (e) {
            console.warn('[recommend] Google Places enrich failed:', e instanceof Error ? e.message : e);
            return r;
        }
    }));
}

function parseBias(lat, lng) {
    const la = Number(lat);
    const ln = Number(lng);
    if (!Number.isFinite(la) || !Number.isFinite(ln) || Math.abs(la) > 90 || Math.abs(ln) > 180) return null;
    return { lat: la, lng: ln };
}

export default async function handler(req, res) {
    applyCors(req, res, 'POST,OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
    if (isRateLimited(req)) return res.status(429).json({ error: 'rate_limited' });

    const placeName = sanitizeInput(req.body?.placeName, 100);
    const city = sanitizeInput(req.body?.city, 60);
    const category = CATEGORIES.has(req.body?.category) ? req.body.category : 'all';
    const locale = parseLocale(req.body?.locale);
    const bias = parseBias(req.body?.lat, req.body?.lng);
    if (!placeName) return res.status(400).json({ error: 'place_required' });

    const db = supabaseAdmin();
    const cacheKey = {
        kind: 'nearby',
        city_key: normalizeKey(city),
        place_key: normalizeKey(placeName),
        category,
        locale,
    };

    if (db) {
        const { data: hit, error } = await db
            .from('ai_recommendation_cache')
            .select('id, payload, provider, model_used, hit_count')
            .match(cacheKey)
            .gt('expires_at', new Date().toISOString())
            .maybeSingle();
        if (error) console.warn('[recommend] cache read failed:', error.message);
        if (hit && Array.isArray(hit.payload?.recommendations)) {
            void db.from('ai_recommendation_cache').update({ hit_count: (hit.hit_count ?? 0) + 1 }).eq('id', hit.id).then(() => {});
            return res.status(200).json({
                success: true,
                cached: true,
                provider: hit.provider,
                modelUsed: hit.model_used,
                basePlace: placeName,
                recommendations: hit.payload.recommendations,
            });
        }
    }

    if (hasLlmProvider()) {
        try {
            const result = await chatCompletion({
                system: 'You are an expert travel assistant. Output ONLY valid JSON.',
                user: buildPrompt({ placeName, city, category, locale }),
                json: true,
                timeoutMs: LLM_TIMEOUT_MS,
            });
            const recs = sanitizeRecommendations(parseJsonObject(result.content)?.recommendations, placeName);
            if (recs.length > 0) {
                const enriched = await enrichWithGoogleMaps(recs, city, bias);
                if (db) {
                    const expiresAt = new Date(Date.now() + CACHE_TTL_DAYS * 86_400_000).toISOString();
                    const { error } = await db.from('ai_recommendation_cache').upsert(
                        { ...cacheKey, payload: { recommendations: enriched }, provider: result.provider, model_used: result.model, hit_count: 0, created_at: new Date().toISOString(), expires_at: expiresAt },
                        { onConflict: 'kind,city_key,place_key,category,locale' },
                    );
                    if (error) console.warn('[recommend] cache write failed:', error.message);
                }
                return res.status(200).json({
                    success: true,
                    provider: result.provider,
                    modelUsed: result.model,
                    basePlace: placeName,
                    recommendations: enriched,
                });
            }
        } catch (e) {
            console.warn('[recommend] LLM call failed:', e instanceof Error ? e.message : e);
        }
    }

    const curated = locale === 'ko' ? getCuratedFallbackRecommendations(placeName, city, category) : [];
    if (curated.length === 0) {
        return res.status(503).json({ error: 'recommendation_unavailable' });
    }
    const enrichedCurated = await enrichWithGoogleMaps(curated, city, bias);
    return res.status(200).json({
        success: true,
        provider: 'Triptic Curated',
        modelUsed: 'curated-recommendations',
        isFallback: true,
        basePlace: placeName,
        recommendations: enrichedCurated,
    });
}
