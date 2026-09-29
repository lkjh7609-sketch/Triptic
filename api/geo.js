// Vercel Serverless Function: 접속 국가
// Endpoint: GET /api/geo → { country: 'KR' | 'US' | … | null }
//
// 처음 접속한 사람의 표시 언어를 정할 때만 부른다(한국이면 한국어, 그 밖은 영어 —
// src/shared/i18n/geoLocale.ts). 국가는 Vercel이 요청마다 붙여 주는 x-vercel-ip-country
// 헤더에서 읽는다 — IP 자체는 저장하지도 돌려주지도 않는다. 로컬 개발처럼 헤더가 없으면 null.
import { applyCors } from './_lib/http.js';

export default function handler(req, res) {
    applyCors(req, res, 'GET,OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

    const raw = req.headers['x-vercel-ip-country'];
    const country = typeof raw === 'string' && /^[A-Z]{2}$/.test(raw) ? raw : null;
    // 사람마다 다르다 — CDN에 캐시되면 다른 나라 사람에게 남의 결과가 간다
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json({ country });
}
