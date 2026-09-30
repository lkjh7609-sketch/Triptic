// Vercel Serverless Function: 제휴사 상품 검색(액티비티 탭 카드)
// Endpoint: GET /api/partnerProducts?provider=myrealtrip&q=오사카&size=8
//           GET /api/partnerProducts?provider=myrealtrip&kind=sim&q=도쿄&size=4 (그 도시에서 쓸 유심·eSIM)
//           GET /api/partnerProducts?provider=myrealtrip&kind=deals&origin=ICN&period=5 (출발지별 인기 노선 최저가 — 항공 탭 특가)
//
// 제휴사 상품 검색 API 결과를 앱 카드 모양으로 돌려준다. 상품을 누를 때만 /api/partnerLink로
// 추적 링크를 만든다(카드마다 미리 만들면 화면 한 번에 유료 호출이 N번).
import { applyCors, createRateLimiter, sanitizeInput } from './_lib/http.js';
import * as myrealtrip from './_lib/affiliates/myrealtrip.js';

const isRateLimited = createRateLimiter(30);

const PROVIDERS = {
    myrealtrip: {
        isConfigured: myrealtrip.isConfigured,
        search: myrealtrip.searchProducts,
        searchSim: myrealtrip.searchSimProducts,
        searchDeals: myrealtrip.searchFlightDeals,
    },
};

export default async function handler(req, res) {
    applyCors(req, res, 'GET,OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
    if (isRateLimited(req)) return res.status(429).json({ error: 'rate_limited' });

    const provider = Object.prototype.hasOwnProperty.call(PROVIDERS, req.query?.provider) ? PROVIDERS[req.query.provider] : null;
    // 항공 특가 — 검색어 없이 출발지(공항 코드)와 여행 기간(3~7일)만 받는다
    if (provider && req.query?.kind === 'deals') {
        const origin = typeof req.query.origin === 'string' ? req.query.origin.toUpperCase() : 'ICN';
        const period = Number(req.query.period ?? 5);
        if (!/^[A-Z]{3}$/.test(origin) || !Number.isInteger(period) || period < 3 || period > 7) return res.status(400).json({ error: 'invalid_request' });
        if (!provider.isConfigured()) return res.status(503).json({ error: 'partner_unavailable' });
        try {
            const items = await provider.searchDeals(origin, period);
            // 최저가는 실시간이 아니라 저장값이라 몇 시간 캐시해도 된다. 비면 캐시하지 않는다
            res.setHeader('Cache-Control', items.length > 0 ? 'public, s-maxage=10800, stale-while-revalidate=43200' : 'no-store');
            return res.status(200).json({ items });
        } catch (e) {
            console.warn('[partnerProducts] deals failed:', e instanceof Error ? e.message : e);
            return res.status(502).json({ error: 'partner_failed' });
        }
    }

    const keyword = sanitizeInput(req.query?.q, 60);
    const size = Math.min(Math.max(Number(req.query?.size) || 8, 1), 20);
    if (!provider || !keyword) return res.status(400).json({ error: 'invalid_request' });
    if (!provider.isConfigured()) return res.status(503).json({ error: 'partner_unavailable' });

    try {
        const items = req.query?.kind === 'sim' ? await provider.searchSim(keyword, size) : await provider.search(keyword, size);
        // 빈 결과는 캐시하지 않는다 — 일시적으로 비어 온 응답이 6시간 동안 모두에게 나가지 않게
        res.setHeader('Cache-Control', items.length > 0 ? 'public, s-maxage=21600, stale-while-revalidate=86400' : 'no-store');
        return res.status(200).json({ items });
    } catch (e) {
        console.warn('[partnerProducts] search failed:', e instanceof Error ? e.message : e);
        return res.status(502).json({ error: 'partner_failed' });
    }
}
