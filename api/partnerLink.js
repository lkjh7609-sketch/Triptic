// Vercel Serverless Function: 제휴 링크(여러 제휴사 — api/_lib/affiliates 레지스트리)
// Endpoint: GET /api/partnerLink?brand=klook&q=Osaka&locale=ko&placement=trip|search|city|ticket
//           GET /api/partnerLink?brand=yesim&placement=checklist (검색어 없는 브랜드 첫 페이지)
//           GET /api/partnerLink?brand=myrealtrip&kind=search&q=오사카&placement=search
//           GET /api/partnerLink?brand=myrealtrip&kind=page&url=https://experiences.myrealtrip.com/products/<id>&placement=product
//           GET /api/partnerLink?brand=myrealtrip&kind=flight&origin=SEL&origin_type=city&destination=OSA
//               &destination_type=city&depart_date=2026-11-10&return_date=2026-11-15&adults=1&placement=flights|trip_flights
//   (klook은 q 대신 city도 받는다 — 여행 상세가 처음 쓰던 이름)
//
// 브랜드 주소(예: Klook "Osaka" 검색 결과)를 그 제휴사 API로 추적 링크로 바꾼다. 같은 (주소, sub_id)는
// partner_links(0051/0052/0054)에 저장해 한 번만 변환한다. 키는 서버 환경변수로만 — 앱에는 절대 내려보내지 않는다.
import { applyCors, createRateLimiter, parseLocale } from './_lib/http.js';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { LINK_BRANDS, NETWORKS } from './_lib/affiliates/index.js';

const isRateLimited = createRateLimiter(60);

/** 링크를 어디서 눌렀는지 제휴사 리포트·판매 탭에서 구분하는 꼬리표 */
const SUB_ID = {
    trip: 'trip_activity',
    search: 'activities_search',
    city: 'activities_city',
    ticket: 'place_ticket',
    checklist: 'checklist',
    product: 'activities_product',
    flights: 'flights_search',
    trip_flights: 'trip_flights',
    esim: 'flights_esim',
};

const CACHED = 'public, s-maxage=86400, stale-while-revalidate=604800';

export default async function handler(req, res) {
    applyCors(req, res, 'GET,OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
    if (isRateLimited(req)) return res.status(429).json({ error: 'rate_limited' });

    const query = req.query ?? {};
    const brand = typeof query.brand === 'string' && Object.prototype.hasOwnProperty.call(LINK_BRANDS, query.brand) ? LINK_BRANDS[query.brand] : null;
    if (!brand) return res.status(400).json({ error: 'invalid_request' });
    const network = NETWORKS[brand.network];
    const subId = SUB_ID[query.placement] ?? SUB_ID.trip;
    const url = await brand.target(query, parseLocale(query.locale));
    if (!url) return res.status(400).json({ error: 'invalid_request' });

    const db = supabaseAdmin();
    if (db) {
        const { data: hit, error } = await db.from('partner_links').select('partner_url').match({ url, sub_id: subId }).maybeSingle();
        if (error) console.warn('[partnerLink] cache read failed:', error.message);
        if (hit?.partner_url) {
            res.setHeader('Cache-Control', CACHED);
            return res.status(200).json({ url: hit.partner_url, cached: true });
        }
    }

    // 변환을 못 할 때: 대체 링크가 있는 제휴사는 실패로, 없는 곳(마이리얼트립)은 원래 주소로(추적 없음, 캐시 안 함)
    const unavailable = (status, error) => {
        if (network.passThroughWhenUnavailable) {
            res.setHeader('Cache-Control', 'no-store');
            return res.status(200).json({ url, tracked: false });
        }
        return res.status(status).json({ error });
    };

    if (!network.isConfigured()) return unavailable(503, 'partner_unavailable');

    try {
        const { partnerUrl, externalId } = await network.convert(url, subId);
        if (db) {
            const { error } = await db
                .from('partner_links')
                .upsert({ url, sub_id: subId, brand: query.brand, partner_url: partnerUrl, external_id: externalId });
            if (error) console.warn('[partnerLink] cache write failed:', error.message);
        }
        res.setHeader('Cache-Control', CACHED);
        return res.status(200).json({ url: partnerUrl, cached: false });
    } catch (e) {
        console.warn('[partnerLink] conversion failed:', e instanceof Error ? e.message : e);
        return unavailable(502, 'partner_failed');
    }
}
