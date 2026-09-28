// Vercel Serverless Function: 도시별 제휴(Travelpayouts) 링크
// Endpoint: GET /api/partnerLink?brand=klook&q=Osaka&locale=ko&placement=trip|search|city
//   (q 대신 city도 받는다 — 여행 상세가 처음 쓰던 이름)
//
// 브랜드 검색 주소(예: Klook "Osaka" 검색 결과)를 Travelpayouts 링크 변환 API로 제휴
// 링크로 바꾼다. 같은 (주소, sub_id)는 partner_links(0051/0052)에 저장해 한 번만 변환한다.
// 토큰(TRAVELPAYOUTS_API_TOKEN)은 서버 환경변수로만 — 앱에는 절대 내려보내지 않는다.
import { applyCors, createRateLimiter, sanitizeInput, parseLocale } from './_lib/http.js';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';

// 프로젝트 ID(trs)와 파트너 ID(marker)는 비밀이 아니다(제휴 링크에 그대로 드러남)
const TP_TRS = Number(process.env.TRAVELPAYOUTS_TRS || 578749);
const TP_MARKER = Number(process.env.TRAVELPAYOUTS_MARKER || 782766);
const isRateLimited = createRateLimiter(60);

const KLOOK_LOCALE_PATH = { ko: 'ko', en: 'en-US', ja: 'ja', 'zh-TW': 'zh-TW' };

/** 링크를 어디서 눌렀는지 Travelpayouts 리포트에서 구분하는 꼬리표 */
const SUB_ID = { trip: 'trip_activity', search: 'activities_search', city: 'activities_city' };

function brandUrl(brand, city, locale) {
    if (brand === 'klook') return `https://www.klook.com/${KLOOK_LOCALE_PATH[locale]}/search/result/?query=${encodeURIComponent(city)}`;
    return null;
}

async function convert(url, subId) {
    const res = await fetch('https://api.travelpayouts.com/links/v1/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Access-Token': process.env.TRAVELPAYOUTS_API_TOKEN },
        body: JSON.stringify({ trs: TP_TRS, marker: TP_MARKER, shorten: true, links: [{ url, sub_id: subId }] }),
        signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`travelpayouts HTTP ${res.status}`);
    const data = await res.json();
    const link = data?.result?.links?.[0];
    if (link?.code !== 'success' || typeof link.partner_url !== 'string' || !link.partner_url) {
        throw new Error(`travelpayouts conversion failed: ${link?.message ?? data?.error ?? 'unknown'}`);
    }
    return link.partner_url;
}

export default async function handler(req, res) {
    applyCors(req, res, 'GET,OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
    if (isRateLimited(req)) return res.status(429).json({ error: 'rate_limited' });

    const brand = req.query?.brand;
    const query = sanitizeInput(req.query?.q ?? req.query?.city, 80);
    const locale = parseLocale(req.query?.locale);
    const subId = SUB_ID[req.query?.placement] ?? SUB_ID.trip;
    const url = typeof brand === 'string' && query ? brandUrl(brand, query, locale) : null;
    if (!url) return res.status(400).json({ error: 'invalid_request' });

    const db = supabaseAdmin();
    if (db) {
        const { data: hit, error } = await db.from('partner_links').select('partner_url').match({ url, sub_id: subId }).maybeSingle();
        if (error) console.warn('[partnerLink] cache read failed:', error.message);
        if (hit?.partner_url) {
            res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
            return res.status(200).json({ url: hit.partner_url, cached: true });
        }
    }

    if (!process.env.TRAVELPAYOUTS_API_TOKEN) return res.status(503).json({ error: 'partner_unavailable' });

    try {
        const partnerUrl = await convert(url, subId);
        if (db) {
            const { error } = await db.from('partner_links').upsert({ url, sub_id: subId, brand, partner_url: partnerUrl });
            if (error) console.warn('[partnerLink] cache write failed:', error.message);
        }
        res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
        return res.status(200).json({ url: partnerUrl, cached: false });
    } catch (e) {
        console.warn('[partnerLink] conversion failed:', e instanceof Error ? e.message : e);
        return res.status(502).json({ error: 'partner_failed' });
    }
}
