// Vercel Serverless Function: 제휴사 상품 검색(액티비티 탭 카드)
// Endpoint: GET /api/partnerProducts?provider=myrealtrip&q=오사카&size=8
//
// 제휴사 상품 검색 API 결과를 앱 카드 모양으로 돌려준다. 상품을 누를 때만 /api/partnerLink로
// 추적 링크를 만든다(카드마다 미리 만들면 화면 한 번에 유료 호출이 N번).
import { applyCors, createRateLimiter, sanitizeInput } from './_lib/http.js';
import * as myrealtrip from './_lib/affiliates/myrealtrip.js';

const isRateLimited = createRateLimiter(30);

const PROVIDERS = {
    myrealtrip: { isConfigured: myrealtrip.isConfigured, search: myrealtrip.searchProducts },
};

export default async function handler(req, res) {
    applyCors(req, res, 'GET,OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
    if (isRateLimited(req)) return res.status(429).json({ error: 'rate_limited' });

    const provider = Object.prototype.hasOwnProperty.call(PROVIDERS, req.query?.provider) ? PROVIDERS[req.query.provider] : null;
    const keyword = sanitizeInput(req.query?.q, 60);
    const size = Math.min(Math.max(Number(req.query?.size) || 8, 1), 20);
    if (!provider || !keyword) return res.status(400).json({ error: 'invalid_request' });
    if (!provider.isConfigured()) return res.status(503).json({ error: 'partner_unavailable' });

    try {
        const items = await provider.search(keyword, size);
        res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
        return res.status(200).json({ items });
    } catch (e) {
        console.warn('[partnerProducts] search failed:', e instanceof Error ? e.message : e);
        return res.status(502).json({ error: 'partner_failed' });
    }
}
