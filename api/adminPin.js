// Vercel Serverless Function: 관리자 6자리 비밀번호(PIN) 로그인
// GET  /api/adminPin            → { enabled, locked, retryAfter }   (시도 횟수를 세지 않는다)
// POST /api/adminPin {pin}      → 200 { session } | 401 { error:'wrong_pin', attemptsLeft } | 429 { error:'locked', retryAfter }
//
// 맞으면 관리자 계정의 로그인 세션을 내려 준다(앱이 setSession으로 넣는다). 시도 횟수 잠금은 DB(0063)가 전역·원자적으로 건다:
// 누가 어디서 시도하든 합쳐서 5번 틀리면 15분 동안 모두 잠긴다. 잠긴 동안에는 PIN을 검사조차 하지 않는다.
// PIN·요청 본문은 로그에 남기지 않는다.
import { applyCors, createRateLimiter, ALLOWED_ORIGINS } from './_lib/http.js';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { PIN_MAX_ATTEMPTS, mintAdminSession, pinConfig, pinMatches } from './_lib/adminPin.js';

// 잠금이 진짜 방어선이고, 이건 DB를 덜 두드리게 하는 앞단의 가벼운 제한이다
const isRateLimited = createRateLimiter(15);

function fail(res, status, error, extra = {}) {
    return res.status(status).json({ error, ...extra });
}

export default async function handler(req, res) {
    applyCors(req, res, 'GET,POST,OPTIONS', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET' && req.method !== 'POST') return fail(res, 405, 'method_not_allowed');

    const config = pinConfig();
    const db = supabaseAdmin();

    if (req.method === 'GET') {
        if (!config.enabled || !db) return res.status(200).json({ enabled: false, locked: false, retryAfter: 0 });
        const { data } = await db.rpc('admin_pin_status');
        const row = Array.isArray(data) ? data[0] : data;
        return res.status(200).json({ enabled: true, locked: !!row?.locked, retryAfter: row?.retry_after ?? 0 });
    }

    // POST — 다른 사이트의 페이지에서 몰래 부르지 못하게 출처를 확인한다(출처가 없으면 거절)
    const origin = req.headers.origin;
    if (!origin || !ALLOWED_ORIGINS.has(origin)) return fail(res, 403, 'forbidden');
    if (isRateLimited(req)) return fail(res, 429, 'rate_limited');
    if (!config.enabled || !db) return fail(res, 503, 'pin_disabled');

    let body = req.body;
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
        } catch {
            body = null;
        }
    }
    const pin = typeof body?.pin === 'string' ? body.pin : '';
    if (!/^\d{6}$/.test(pin)) return fail(res, 400, 'bad_format');

    // 시도를 "먼저" 센다 — 잠겨 있으면 PIN을 보지 않고 돌려보낸다
    const { data: begin, error: beginErr } = await db.rpc('admin_pin_begin', { p_max: PIN_MAX_ATTEMPTS });
    const state = Array.isArray(begin) ? begin[0] : begin;
    if (beginErr || !state) {
        console.warn('[adminPin] lock check failed');
        return fail(res, 503, 'lock_unavailable'); // 잠금을 확인 못 하면 시도를 받지 않는다
    }
    if (!state.allowed) return fail(res, 429, 'locked', { retryAfter: state.retry_after });

    if (!pinMatches(pin, config.pin)) {
        const attemptsLeft = Math.max(0, PIN_MAX_ATTEMPTS - state.attempt_no);
        return fail(res, 401, 'wrong_pin', { attemptsLeft, ...(attemptsLeft === 0 ? { retryAfter: 900 } : {}) });
    }

    try {
        const session = await mintAdminSession(db);
        await db.rpc('admin_pin_reset');
        return res.status(200).json({ session });
    } catch (e) {
        console.warn('[adminPin] session failed:', e instanceof Error ? e.message : 'unknown');
        return fail(res, 503, 'session_failed');
    }
}
