// Vercel Serverless Function: 제휴사 상품 검색(액티비티 탭 카드)
// Endpoint: GET /api/partnerProducts?provider=myrealtrip&q=오사카&size=8
//           GET /api/partnerProducts?provider=myrealtrip&kind=sim&q=도쿄&size=4 (그 도시에서 쓸 유심·eSIM)
//           GET /api/partnerProducts?provider=myrealtrip&kind=deals&origin=ICN&period=5 (출발지별 인기 노선 최저가 — 항공 탭 특가)
//           GET /api/partnerProducts?provider=myrealtrip&kind=list&q=시드니&category=tour&maxPrice=200000&sort=price_asc&page=2&size=20
//               (액티비티 탭 필터·정렬·더 보기 — {items, hasNextPage, totalCount})
//           GET /api/partnerProducts?provider=myrealtrip&kind=categories&q=시드니 (그 도시의 카테고리 목록 — 도시마다 다르다)
//
// 제휴사 상품 검색 API 결과를 앱 카드 모양으로 돌려준다. 상품을 누를 때만 /api/partnerLink로
// 추적 링크를 만든다(카드마다 미리 만들면 화면 한 번에 유료 호출이 N번).
import { applyCors, createRateLimiter, sanitizeInput } from './_lib/http.js';
import * as myrealtrip from './_lib/affiliates/myrealtrip.js';

// 액티비티 탭이 필터를 바꿀 때마다(미리보기 포함) 부르므로 여유를 둔다. 응답은 CDN에 캐시돼 같은 조건은 여기까지 안 온다
const isRateLimited = createRateLimiter(60);

const PROVIDERS = {
    myrealtrip: {
        isConfigured: myrealtrip.isConfigured,
        search: myrealtrip.searchProducts,
        searchSim: myrealtrip.searchSimProducts,
        searchDeals: myrealtrip.searchFlightDeals,
        searchPage: myrealtrip.searchProductsPage,
        listCategories: myrealtrip.listCategories,
    },
};

/**
 * 액티비티 탭 목록 필터 검증. 안 준 값은 건너뛰고(기본 동작), 준 값이 틀리면 null.
 * category=all은 받지 않는다(전체는 category를 생략) — 카테고리 값은 도시마다 달라 모양만 확인한다.
 */
export function parseListFilters(query) {
    const out = {};
    if (query.category != null && query.category !== '') {
        if (typeof query.category !== 'string' || query.category === 'all' || !myrealtrip.CATEGORY_VALUE.test(query.category)) return null;
        out.category = query.category;
    }
    if (query.maxPrice != null && query.maxPrice !== '') {
        const maxPrice = Number(query.maxPrice);
        if (!Number.isInteger(maxPrice) || maxPrice < 1000 || maxPrice > 10_000_000) return null;
        out.maxPrice = maxPrice;
    }
    if (query.sort != null && query.sort !== '') {
        if (!myrealtrip.TNA_SORTS.includes(query.sort)) return null;
        out.sort = query.sort;
    }
    const page = query.page == null || query.page === '' ? 1 : Number(query.page);
    if (!Number.isInteger(page) || page < 1 || page > 10) return null;
    out.page = page;
    return out;
}

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

    // 유료 키를 쓰는 공개 엔드포인트라 필터 값은 모양을 좁게 확인하고, 틀리면 호출하지 않는다
    if (req.query?.kind === 'categories') {
        try {
            const categories = await provider.listCategories(keyword);
            res.setHeader('Cache-Control', categories.length > 0 ? 'public, s-maxage=86400, stale-while-revalidate=604800' : 'no-store');
            return res.status(200).json({ categories });
        } catch (e) {
            console.warn('[partnerProducts] categories failed:', e instanceof Error ? e.message : e);
            return res.status(502).json({ error: 'partner_failed' });
        }
    }
    if (req.query?.kind === 'list') {
        const filters = parseListFilters(req.query);
        if (!filters) return res.status(400).json({ error: 'invalid_request' });
        try {
            const result = await provider.searchPage(keyword, { size, ...filters });
            // 필터가 정말 0건을 돌려줄 수도 있으니(그게 맞는 답) 빈 결과는 캐시만 하지 않는다
            res.setHeader('Cache-Control', result.items.length > 0 ? 'public, s-maxage=21600, stale-while-revalidate=86400' : 'no-store');
            return res.status(200).json(result);
        } catch (e) {
            console.warn('[partnerProducts] list failed:', e instanceof Error ? e.message : e);
            return res.status(502).json({ error: 'partner_failed' });
        }
    }

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
