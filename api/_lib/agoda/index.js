// /api/partnerProducts?provider=agoda … 의 처리부 (Vercel 함수 개수 한도 때문에 별도 함수 파일을 만들지 않고 partnerProducts가 부른다)
//   kind=hotels&lat=13.75&lng=100.5&checkin=2026-11-20&checkout=2026-11-22&adults=2&childAges=5|8&currency=KRW&lang=ko
//        &sort=recommended|priceAsc|priceDesc|starsDesc|reviewScore&minStars=4&minReview=8&minPrice=…&maxPrice=…&discountOnly=1
//        → { city: {id,name,country,distanceKm}|null, hotels[], nights, currency }
// 키(AGODA_API_KEY)가 없으면 503 not_configured — 앱은 '준비 중' 안내를 보여 준다.
import { isConfigured } from './client.js';
import { parseHotelQuery, searchHotels } from './hotels.js';

export async function handleAgoda(req, res) {
    if (!isConfigured()) return res.status(503).json({ error: 'not_configured' });
    const query = req.query ?? {};
    try {
        if (query.kind === 'hotels') {
            const filters = parseHotelQuery(query);
            if (!filters) return res.status(400).json({ error: 'invalid_request' });
            const out = await searchHotels(filters);
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
