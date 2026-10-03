// Kayak Affiliate API 호출 공통부 — https://developers.kayak.com
// 키는 서버 환경변수 KAYAK_API_KEY로만(앱에는 절대 내려보내지 않는다). 주소는 KAYAK_API_BASE로 바꾼다 —
// 없으면 샌드박스(가짜 가격·사진, 예약 링크는 가짜 클릭 페이지). 운영 주소·키를 받으면 두 값만 바꾸면 된다.
import { clientIp } from '../http.js';

const SANDBOX_BASE = 'https://sandbox-en-us.kayakaffiliates.com';

export function isConfigured() {
    return Boolean(process.env.KAYAK_API_KEY);
}

export function baseUrl() {
    return (process.env.KAYAK_API_BASE || SANDBOX_BASE).replace(/\/+$/, '');
}

/** 샌드박스 주소인지 — 화면에 시험 데이터 안내를 띄우는 데 쓴다 */
export function isSandbox() {
    return baseUrl() === SANDBOX_BASE;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Kayak은 사용자(세션)마다 고유 userTrackId를 요구한다 — 앱이 이 기기에 만들어 둔 UUID를 받고, 없거나 틀리면 요청마다 새로 만든다 */
export function userTrackId(value) {
    return typeof value === 'string' && UUID.test(value) ? value.toLowerCase() : globalThis.crypto.randomUUID();
}

/** 접속자 IP — Cloudflare 뒤라 cf-connecting-ip가 진짜 접속자다(없으면 x-forwarded-for) */
export function visitorIp(req) {
    const cf = req.headers?.['cf-connecting-ip'];
    return (typeof cf === 'string' && cf.trim()) || clientIp(req);
}

/**
 * Kayak 호출. Kayak이 봇 판별에 쓰는 접속자 IP(x-original-client-ip)와 User-Agent를 그대로 넘긴다.
 * 돌려주는 값: { status, json } (JSON이 아니면 json은 null)
 */
export async function kayakRequest(path, { query = {}, method = 'GET', body, req, trackId, timeoutMs = 12_000 }) {
    const url = new URL(`${baseUrl()}${path}`);
    url.searchParams.set('apiKey', process.env.KAYAK_API_KEY);
    url.searchParams.set('userTrackId', trackId);
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    const ua = req?.headers?.['user-agent'];
    const res = await fetch(url, {
        method,
        headers: {
            ...(body ? { 'content-type': 'application/json' } : {}),
            'x-original-client-ip': visitorIp(req ?? { headers: {} }),
            'user-agent': typeof ua === 'string' && ua ? ua : 'Mozilla/5.0 (compatible; Triptic/1.0)',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    let json = null;
    try {
        json = text ? JSON.parse(text) : null;
    } catch {
        json = null;
    }
    return { status: res.status, json };
}

/** 예약 링크는 https만 내보낸다(javascript: 같은 주소 차단) */
export function safeUrl(value) {
    if (typeof value !== 'string') return null;
    try {
        const u = new URL(value);
        return u.protocol === 'https:' ? u.href : null;
    } catch {
        return null;
    }
}
