// Vercel Serverless Function: 운영 콘솔 "분석" 탭 — PostHog 이용 분석 + Sentry 오류 요약
// Endpoint: GET /api/adminAnalytics?days=7|30|90
//           GET /api/adminAnalytics?view=users  (회원별 최근 90일 이용 기록 — 운영 콘솔 사용자 목록용)
//           Authorization: Bearer <Supabase access token>
//
// 관리자 확인은 서버가 직접 한다(adminSales와 같은 방식): 토큰으로 사용자를 확인하고 profiles.role='admin'이 아니면 403.
// PostHog·Sentry 키는 서버 환경 변수에만 있고(api/_lib/analytics.js), 연결 안 된 쪽은 "연결 전"으로만 보이며
// 어떤 환경 변수 이름이 비었는지만 알려 준다(값은 절대 응답에 넣지 않는다).
import { applyCors, createRateLimiter } from './_lib/http.js';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { ALLOWED_DAYS, fetchPosthogReport, fetchPosthogUserActivity, fetchSentryReport } from './_lib/analytics.js';

const isRateLimited = createRateLimiter(20);
const CACHE_MS = 60_000;
const cache = new Map();

async function requireAdmin(req, db) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return null;
    const { data, error } = await db.auth.getUser(token);
    if (error || !data?.user) return null;
    const { data: profile } = await db.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
    return profile?.role === 'admin' ? data.user : null;
}

/** 같은 기간을 1분 안에 다시 열면 PostHog·Sentry를 또 부르지 않는다(외부 API 호출 한도 보호).
 * 성공한 결과만 담는다 — 오류·미연결은 키를 넣은 직후 바로 반영되게 매번 다시 확인한다 */
async function cached(key, load) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
    const value = await load();
    if (value.status === 'ok') cache.set(key, { at: Date.now(), value });
    return value;
}

export default async function handler(req, res) {
    applyCors(req, res, 'GET,OPTIONS', 'Content-Type, Authorization');
    res.setHeader('Cache-Control', 'private, no-store');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
    if (isRateLimited(req)) return res.status(429).json({ error: 'rate_limited' });

    const db = supabaseAdmin();
    if (!db) return res.status(503).json({ error: 'server_unavailable' });
    const admin = await requireAdmin(req, db);
    if (!admin) return res.status(403).json({ error: 'forbidden' });

    if (req.query?.view === 'users') {
        return res.status(200).json(await cached('posthog:users', () => fetchPosthogUserActivity()));
    }

    const days = Number(req.query?.days ?? 7);
    if (!ALLOWED_DAYS.includes(days)) return res.status(400).json({ error: 'invalid_days' });

    const [posthog, sentry] = await Promise.all([
        cached(`posthog:${days}`, () => fetchPosthogReport(days)),
        cached(`sentry:${days}`, () => fetchSentryReport(days)),
    ]);
    const body = { days, generatedAt: new Date().toISOString(), posthog, sentry };
    return res.status(200).json(body);
}
