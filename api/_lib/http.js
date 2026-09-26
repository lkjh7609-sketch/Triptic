// api/*.js 공용 HTTP 유틸. Vercel은 밑줄(_)로 시작하는 경로를 함수로 배포하지 않는다.

export const ALLOWED_ORIGINS = new Set([
    'https://triptic.my',
    'https://www.triptic.my',
    'https://triptic-ten.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'capacitor://localhost',
]);

export function applyCors(req, res, methods = 'GET,POST,OPTIONS') {
    const origin = req.headers.origin;
    if (origin && ALLOWED_ORIGINS.has(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', methods);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/**
 * 인스턴스 메모리 기반 고정 윈도 rate limit. 서버리스 인스턴스마다 따로 세므로
 * 완벽한 차단은 아니지만, 한 IP가 유료 LLM을 연속 호출하는 걸 막는 1차 방어선이다.
 */
export function createRateLimiter(limit, windowMs = 60_000) {
    const hits = new Map();
    return function isRateLimited(req) {
        const ip = clientIp(req);
        const now = Date.now();
        const rec = hits.get(ip);
        if (!rec || now - rec.start > windowMs) {
            hits.set(ip, { start: now, count: 1 });
            if (hits.size > 5000) hits.clear();
            return false;
        }
        rec.count += 1;
        return rec.count > limit;
    };
}

export function clientIp(req) {
    return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
}

/** 제어문자 제거 + 길이 제한 (LLM 프롬프트/캐시 키에 들어가는 사용자 입력용) */
export function sanitizeInput(value, maxLen) {
    if (typeof value !== 'string') return '';
    // eslint-disable-next-line no-control-regex
    return value.replace(/[\r\n\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

/** 캐시 키 정규화 — 대소문자/공백 차이로 같은 장소가 다른 키가 되지 않게 */
export function normalizeKey(value) {
    return value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

export const SUPPORTED_LOCALES = ['ko', 'en', 'zh-TW', 'ja'];

export function parseLocale(value) {
    if (typeof value !== 'string') return 'ko';
    if (SUPPORTED_LOCALES.includes(value)) return value;
    if (value.toLowerCase().startsWith('zh')) return 'zh-TW';
    const base = value.split('-')[0];
    return SUPPORTED_LOCALES.includes(base) ? base : 'ko';
}

/** LLM 프롬프트에 넣는 "이 언어로 답하라" 지시문 */
export const LOCALE_LANGUAGE_NAME = {
    ko: 'Korean (한국어)',
    en: 'English',
    'zh-TW': 'Traditional Chinese as used in Taiwan (繁體中文, zh-TW)',
    ja: 'Japanese (日本語)',
};
