// /api/partnerProducts?provider=agoda … 의 처리부 (Vercel 함수 개수 한도 때문에 별도 함수 파일을 만들지 않고 partnerProducts가 부른다)
//   kind=hotels&lat=13.75&lng=100.5&checkin=2026-11-20&checkout=2026-11-22&adults=2&childAges=5|8&currency=KRW&lang=ko
//        &sort=recommended|priceAsc|priceDesc|starsDesc|reviewScore&minStars=4&minReview=8&minPrice=…&maxPrice=…&discountOnly=1
//        [&hotelId=2066635]   ← 호텔 이름으로 고른 검색: 그 호텔(pinned, 맨 위 고정) + 같은 도시 추천(hotels)
//        → { city: {id,name,country,distanceKm}|null, hotels[], pinned?, pinnedId?, nights, currency }
//   kind=suggest&q=시그니엘&lang=ko   ← 호텔 이름 자동완성(우리 DB의 아고다 호텔 색인, 0106) → { hotels: [{id,name,city,country,lat,lng,stars}] }
// 키(AGODA_API_KEY)가 없으면 503 not_configured — 앱은 '준비 중' 안내를 보여 준다.
import { sanitizeInput } from '../http.js';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { isConfigured } from './client.js';
import { parseHotelQuery, searchHotels } from './hotels.js';

const SUGGEST_LIMIT = 6;

/** 호텔 ID → 도시(검색할 도시는 브라우저가 아니라 우리 색인에서 정한다). 색인을 못 읽으면 null(좌표 검색으로) */
async function lookupHotel(hotelId) {
    const db = supabaseAdmin();
    if (!db) return null;
    const { data, error } = await db.from('agoda_hotels').select('city_id, city, country').eq('hotel_id', hotelId).maybeSingle();
    if (error || !data) return null;
    return { cityId: data.city_id, cityName: data.city, country: data.country };
}

async function suggest(req, res) {
    const q = sanitizeInput(req.query?.q, 60);
    if (q.length < 2) return res.status(200).json({ hotels: [] });
    const db = supabaseAdmin();
    if (!db) return res.status(503).json({ error: 'not_configured' });
    const { data, error } = await db.rpc('search_agoda_hotels', { p_q: q, p_limit: SUGGEST_LIMIT });
    if (error) {
        console.warn('[agoda] suggest failed:', error.message);
        return res.status(502).json({ error: 'agoda_failed' });
    }
    const ko = (req.query?.lang ?? 'ko') === 'ko';
    const hotels = (data ?? []).map((h) => ({
        id: h.hotel_id,
        name: ko ? h.name_ko || h.name : h.name,
        city: h.city,
        country: h.country,
        lat: h.lat,
        lng: h.lng,
        stars: h.stars,
    }));
    // 이름 색인은 자주 안 바뀐다 — 같은 글자는 하루 CDN에
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).json({ hotels });
}

export async function handleAgoda(req, res) {
    const query = req.query ?? {};
    if (query.kind === 'suggest') return suggest(req, res);
    if (!isConfigured()) return res.status(503).json({ error: 'not_configured' });
    try {
        if (query.kind === 'hotels') {
            const filters = parseHotelQuery(query);
            if (!filters) return res.status(400).json({ error: 'invalid_request' });
            const out = await searchHotels(filters, { lookupHotel });
            // 같은 조건은 잠깐 CDN이 들고 있는다(가격은 자주 바뀌니 오래 두지 않는다)
            res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
            return res.status(200).json(out);
        }
        return res.status(400).json({ error: 'invalid_request' });
    } catch (e) {
        console.warn('[agoda] request failed:', e instanceof Error ? e.message : e);
        return res.status(502).json({ error: 'agoda_failed' });
    }
}
