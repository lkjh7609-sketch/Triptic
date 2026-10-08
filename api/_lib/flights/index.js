// /api/partnerProducts?provider=flights … 의 처리부 (Vercel 함수 개수 한도 때문에 별도 함수 파일을 만들지 않고 partnerProducts가 부른다)
//   kind=search&origin=SEL&destination=TYO&depart_date=2026-11-20&return_date=2026-11-25&adults=2&children=0&infants=0
//        &cabin=ECONOMY|PREMIUM_ECONOMY|BUSINESS|FIRST&locale=ko|en|ja|zh-TW
//        → { currency, offers[], bookingUrl, tracked, observedAt }   (가격은 승객 전체 합계, perPerson은 1인 근사)
// 못 쓸 때(키 없음·월 상한·상대 장애)는 503/502와 함께 bookingUrl을 준다 — 앱이 '예약 사이트에서 검색' 버튼을 보여 준다.
import { parseLocale } from '../http.js';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { parseFlightQuery } from '../affiliates/myrealtrip.js';
import { isConfigured, ignavSearch, normalizeIgnav } from './ignav.js';
import { takeIgnavCall, IgnavCapError } from './cap.js';
import { bookingLinkFor } from './deeplinks.js';

export async function handleFlights(req, res) {
    const query = req.query ?? {};
    if (query.kind !== 'search') return res.status(400).json({ error: 'invalid_request' });
    const search = parseFlightQuery(query);
    if (!search) return res.status(400).json({ error: 'invalid_request' });
    const locale = parseLocale(query.locale);
    const db = supabaseAdmin();

    // 예약 링크는 검색 조건만으로 정해진다. 제휴 변환(DB·Travelpayouts)이 있을 수 있어 운임 검색과 함께 진행하고(던지지 않는다),
    // 어느 경로로 끝나든 마지막에 기다린다 — 순서대로 하면 느린 Ignav와 합쳐 함수 한도(30초)를 넘을 수 있다
    const linkPromise = bookingLinkFor(search, locale, db);
    const withLink = async (status, body, cache) => {
        const link = await linkPromise;
        if (cache) res.setHeader('Cache-Control', cache);
        return res.status(status).json({ ...body, bookingUrl: link.url, tracked: link.tracked });
    };

    if (!isConfigured()) return withLink(503, { error: 'not_configured' });
    try {
        await takeIgnavCall(db);
    } catch (e) {
        if (e instanceof IgnavCapError) {
            console.warn('[flights] monthly cap reached:', e.used, '/', e.limit);
            return withLink(503, { error: 'flights_cap' });
        }
        console.warn('[flights] cap check failed:', e instanceof Error ? e.message : e);
        return withLink(503, { error: 'flights_unavailable' });
    }

    try {
        const out = normalizeIgnav(await ignavSearch(search, locale), search);
        // 같은 조건은 잠깐 CDN이 들고 있는다(가격은 바뀌니 오래 두지 않는다). 빈 결과는 캐시하지 않는다
        return withLink(200, out, out.offers.length > 0 ? 'public, s-maxage=180, stale-while-revalidate=300' : 'no-store');
    } catch (e) {
        console.warn('[flights] search failed:', e instanceof Error ? e.message : e);
        return withLink(502, { error: 'flights_failed' });
    }
}
