// Vercel Serverless Function: 도시별 제휴(Travelpayouts) 링크
// Endpoint: GET /api/partnerLink?brand=klook&city=Osaka&locale=ko
//
// 브랜드 검색 주소(예: Klook "Osaka" 검색 결과)를 Travelpayouts 링크 변환 API로 제휴
// 링크로 바꾼다. 같은 주소는 partner_links(0051)에 저장해 한 번만 변환한다.
// 토큰(TRAVELPAYOUTS_API_TOKEN)은 서버 환경변수로만 — 앱에는 절대 내려보내지 않는다.
import { applyCors, createRateLimiter, sanitizeInput, parseLocale } from './_lib/http.js';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';

// 프로젝트 ID(trs)와 파트너 ID(marker)는 비밀이 아니다(제휴 링크에 그대로 드러남)
const TP_TRS = Number(process.env.TRAVELPAYOUTS_TRS || 578749);
const TP_MARKER = Number(process.env.TRAVELPAYOUTS_MARKER || 782766);
const isRateLimited = createRateLimiter(60);

const KLOOK_LOCALE_PATH = { ko: 'ko', en: 'en-US', ja: 'ja', 'zh-TW': 'zh-TW' };

/** 링크를 어디서 눌렀는지 Travelpayouts 리포트에서 구분하는 꼬리표 */
const SUB_ID = { klook: 'trip_activity' };

function brandUrl(brand, city, locale) {
    if (brand === 'klook') return `https://www.klook.com/${KLOOK_LOCALE_PATH[locale]}/search/result/?query=${encodeURIComponent(city)}`;
    return null;
}

async function convert(url, brand) {
    const res = await fetch('https://api.travelpayouts.com/links/v1/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Access-Token': process.env.TRAVELPAYOUTS_API_TOKEN },
        body: JSON.stringify({ trs: TP_TRS, marker: TP_MARKER, shorten: true, links: [{ url, sub_id: SUB_ID[brand] }] }),
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
    const city = sanitizeInput(req.query?.city, 60);
    const locale = parseLocale(req.query?.locale);
    const url = typeof brand === 'string' && city ? brandUrl(brand, city, locale) : null;
    if (!url) return res.status(400).json({ error: 'invalid_request' });

    const db = supabaseAdmin();
    if (db) {
        const { data: hit, error } = await db.from('partner_links').select('partner_url').eq('url', url).maybeSingle();
        if (error) console.warn('[partnerLink] cache read failed:', error.message);
        if (hit?.partner_url) {
            res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
            return res.status(200).json({ url: hit.partner_url, cached: true });
        }
    }

    if (!process.env.TRAVELPAYOUTS_API_TOKEN) return res.status(503).json({ error: 'partner_unavailable' });

    try {
        const partnerUrl = await convert(url, brand);
        if (db) {
            const { error } = await db.from('partner_links').upsert({ url, brand, partner_url: partnerUrl });
            if (error) console.warn('[partnerLink] cache write failed:', error.message);
        }
        res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
        return res.status(200).json({ url: partnerUrl, cached: false });
    } catch (e) {
        console.warn('[partnerLink] conversion failed:', e instanceof Error ? e.message : e);
        return res.status(502).json({ error: 'partner_failed' });
    }
}
