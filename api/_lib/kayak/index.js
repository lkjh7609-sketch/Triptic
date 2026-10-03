// /api/partnerProducts?provider=kayak … 의 처리부 (Vercel 함수 개수 한도 때문에 별도 함수 파일을 만들지 않고 partnerProducts가 부른다)
//   kind=place&type=flights|hotels&q=서울             → { items: [...] }  (자동완성)
//   kind=flights&origin=SEL&destination=TYO&depart=2026-11-20&return=…&adults=1&cabin=ECONOMY&currency=USD&sort=best&stops=0
//       (이어서 받기: searchId=…&cluster=…)           → { status, searchId, cluster, offers[] … }
//   kind=hotels&destination=kplace:22327&checkin=…&checkout=…&adults=2&rooms=1&currency=USD&lang=en&sort=price&stars=4|5 → { hotels[], filters … }
// 키(KAYAK_API_KEY)가 없으면 503 not_configured — 앱은 '준비 중' 안내를 보여 준다.
import { isConfigured, isSandbox, userTrackId } from './client.js';
import { searchPlaces } from './places.js';
import { parseFlightQuery, searchFlights } from './flights.js';
import { parseHotelQuery, searchHotels } from './hotels.js';

export async function handleKayak(req, res) {
    if (!isConfigured()) return res.status(503).json({ error: 'not_configured' });
    const query = req.query ?? {};
    const trackId = userTrackId(query.uid);
    try {
        if (query.kind === 'place') {
            if (query.type !== 'flights' && query.type !== 'hotels') return res.status(400).json({ error: 'invalid_request' });
            const out = await searchPlaces({ type: query.type, q: query.q, req, trackId });
            res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
            return res.status(200).json(out);
        }
        if (query.kind === 'flights') {
            const filters = parseFlightQuery(query);
            if (!filters) return res.status(400).json({ error: 'invalid_request' });
            const out = await searchFlights({ filters, req, trackId });
            res.setHeader('Cache-Control', 'no-store');
            return res.status(200).json({ ...out, sandbox: isSandbox() });
        }
        if (query.kind === 'hotels') {
            const filters = parseHotelQuery(query);
            if (!filters) return res.status(400).json({ error: 'invalid_request' });
            const out = await searchHotels({ filters, req, trackId });
            res.setHeader('Cache-Control', 'no-store');
            return res.status(200).json({ ...out, sandbox: isSandbox() });
        }
        return res.status(400).json({ error: 'invalid_request' });
    } catch (e) {
        console.warn('[kayak] request failed:', e instanceof Error ? e.message : e);
        return res.status(502).json({ error: 'kayak_failed' });
    }
}
