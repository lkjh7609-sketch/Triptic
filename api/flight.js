// Vercel Serverless Function: aviationstack 프록시
// 목적: AVIATIONSTACK_API_KEY를 서버에만 두고, 브라우저에는 절대 노출하지 않는다.
// EndPoint: GET /api/flight?type=airport&iata=ICN
//           GET /api/flight?type=flight&flightNo=OZ102&date=2026-09-20

const ALLOWED_ORIGINS = new Set([
    'https://triptic.my',
    'https://www.triptic.my',
    'https://triptic-ten.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'capacitor://localhost'
]);

// 인스턴스 단위 간이 레이트리밋 (콜드 스타트마다 초기화됨 — 완전한 방어는 아니지만
// 한 인스턴스가 살아있는 동안의 스크립트성 남용은 억제한다)
const hits = new Map();
function isRateLimited(ip, limit = 30, windowMs = 60_000) {
    const now = Date.now();
    const rec = hits.get(ip);
    if (!rec || now - rec.start > windowMs) {
        hits.set(ip, { start: now, count: 1 });
        return false;
    }
    rec.count += 1;
    return rec.count > limit;
}

function applyCors(req, res) {
    const origin = req.headers.origin;
    if (origin && ALLOWED_ORIGINS.has(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const IATA_RE = /^[A-Z0-9]{2,4}$/;
const FLIGHT_NO_RE = /^[A-Z0-9]{2,8}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function handler(req, res) {
    applyCors(req, res);

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
    if (isRateLimited(ip)) {
        return res.status(429).json({ error: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' });
    }

    const apiKey = process.env.AVIATIONSTACK_API_KEY;
    if (!apiKey) {
        return res.status(503).json({ error: '항공편 조회 서비스가 설정되지 않았습니다.' });
    }

    const { type, iata, flightNo, date } = req.query || {};

    try {
        if (type === 'airport') {
            if (typeof iata !== 'string' || !IATA_RE.test(iata)) {
                return res.status(400).json({ error: '유효하지 않은 공항 코드입니다.' });
            }
            const url = `https://api.aviationstack.com/v1/airports?access_key=${apiKey}&iata_code=${encodeURIComponent(iata)}`;
            const upstream = await fetch(url);
            const data = await upstream.json();
            return res.status(upstream.ok ? 200 : 502).json(data);
        }

        if (type === 'flight') {
            if (typeof flightNo !== 'string' || !FLIGHT_NO_RE.test(flightNo.trim())) {
                return res.status(400).json({ error: '유효하지 않은 편명입니다.' });
            }
            if (typeof date !== 'string' || !DATE_RE.test(date)) {
                return res.status(400).json({ error: '유효하지 않은 날짜입니다.' });
            }
            const url = `https://api.aviationstack.com/v1/flights?access_key=${apiKey}&flight_iata=${encodeURIComponent(flightNo.trim())}&flight_date=${date}`;
            const upstream = await fetch(url);
            const data = await upstream.json();
            return res.status(upstream.ok ? 200 : 502).json(data);
        }

        return res.status(400).json({ error: 'type 파라미터는 airport 또는 flight 여야 합니다.' });
    } catch (e) {
        console.error('[api/flight] upstream error:', e);
        return res.status(502).json({ error: '항공편 정보를 조회하는 중 오류가 발생했습니다.' });
    }
}
