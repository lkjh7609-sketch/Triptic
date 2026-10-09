import { createHash, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// 관리자 6자리 비밀번호(PIN) 로그인 — 서버에서만 다루는 부분.
// 설정: ADMIN_PIN (정확히 6자리 숫자, Vercel 서버 환경 변수 — VITE_ 아님)
// 시도 횟수 잠금은 DB(0063: admin_pin_begin)가 전역·원자적으로 한다. 여기는 PIN 검사와 세션 발급만.

export const PIN_MAX_ATTEMPTS = 5;

/** 같은 숫자 반복(000000)이나 연속(123456, 654321)처럼 뻔한 값은 PIN으로 쓰지 못하게 한다 */
export function isWeakPin(pin) {
    if (/^(\d)\1{5}$/.test(pin)) return true;
    const d = [...pin].map(Number);
    const step = d[1] - d[0];
    if ((step === 1 || step === -1) && d.every((n, i) => i === 0 || n - d[i - 1] === step)) return true;
    return ['121212', '112233', '123123', '123321', '520520', '202020'].includes(pin);
}

/** ADMIN_PIN 설정 확인 — 없거나 6자리 숫자가 아니거나 너무 뻔하면 PIN 로그인을 아예 끈다(닫힌 쪽으로 실패) */
export function pinConfig(env = process.env) {
    const pin = String(env.ADMIN_PIN ?? '').trim();
    if (!/^\d{6}$/.test(pin)) return { enabled: false, reason: 'not_configured' };
    if (isWeakPin(pin)) return { enabled: false, reason: 'weak' };
    return { enabled: true, pin };
}

const sha = (value) => createHash('sha256').update(String(value)).digest();

/** 시간이 같게 걸리는 비교 — 맞는 자릿수를 응답 시간으로 짐작하지 못하게 */
export function pinMatches(input, expected) {
    return timingSafeEqual(sha(input), sha(expected));
}

/**
 * 6자리 보안코드를 검사한다 — 로그인 키패드(/api/adminPin)와 강제 탈퇴 확인이 같이 쓴다.
 * 시도를 "먼저" 센다(admin_pin_begin, 전역·원자적): 잠겨 있으면 코드를 보지 않고 돌려보낸다. 5번 틀리면 15분 잠금.
 * 맞으면 틀린 횟수를 지운다(reset: false면 지우지 않는다 — 로그인은 세션을 만든 뒤에 지운다).
 * 돌려주는 값: { ok: true } | { ok: false, status, body } — body는 /api/adminPin 응답과 같은 모양이다.
 */
export async function verifyAdminPin(db, pin, { env = process.env, reset = true } = {}) {
    const config = pinConfig(env);
    if (!config.enabled) return { ok: false, status: 503, body: { error: 'pin_disabled' } };
    if (typeof pin !== 'string' || !/^\d{6}$/.test(pin)) return { ok: false, status: 400, body: { error: 'bad_format' } };

    const { data: begin, error: beginErr } = await db.rpc('admin_pin_begin', { p_max: PIN_MAX_ATTEMPTS });
    const state = Array.isArray(begin) ? begin[0] : begin;
    // 잠금을 확인하지 못하면 시도를 받지 않는다(닫힌 쪽으로 실패)
    if (beginErr || !state) return { ok: false, status: 503, body: { error: 'lock_unavailable' } };
    if (!state.allowed) return { ok: false, status: 429, body: { error: 'locked', retryAfter: state.retry_after } };

    if (!pinMatches(pin, config.pin)) {
        const attemptsLeft = Math.max(0, PIN_MAX_ATTEMPTS - state.attempt_no);
        return { ok: false, status: 401, body: { error: 'wrong_pin', attemptsLeft, ...(attemptsLeft === 0 ? { retryAfter: 900 } : {}) } };
    }
    if (reset) await db.rpc('admin_pin_reset');
    return { ok: true };
}

/**
 * 관리자 계정으로 로그인 세션을 발급한다. 서비스 키로 그 계정의 로그인 링크(메일로 보내지 않음)를 만들고,
 * 그 링크의 토큰을 바로 확인해 세션(access/refresh 토큰)으로 바꾼다 — 그래서 이후의 모든 관리 기능은 지금처럼
 * 관리자 로그인 상태의 권한 검사(RLS·RPC)를 그대로 거친다.
 * 관리자 계정이 정확히 1개일 때만 발급한다(여럿이면 누구 계정인지 정할 수 없어 닫힌 쪽으로 실패).
 */
export async function mintAdminSession(db, env = process.env) {
    const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) throw new Error('supabase env missing');

    const { data: admins, error: adminErr } = await db.from('profiles').select('id').eq('role', 'admin');
    if (adminErr) throw new Error(`admin lookup failed: ${adminErr.message}`);
    if (!admins || admins.length !== 1) throw new Error(`expected exactly one admin, found ${admins?.length ?? 0}`);

    const { data: userData, error: userErr } = await db.auth.admin.getUserById(admins[0].id);
    const email = userData?.user?.email;
    if (userErr || !email) throw new Error('admin account has no email');

    const { data: link, error: linkErr } = await db.auth.admin.generateLink({ type: 'magiclink', email });
    const tokenHash = link?.properties?.hashed_token;
    if (linkErr || !tokenHash) throw new Error(`generateLink failed: ${linkErr?.message ?? 'no token'}`);

    const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: verified, error: verifyErr } = await client.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
    const session = verified?.session;
    if (verifyErr || !session) throw new Error(`verifyOtp failed: ${verifyErr?.message ?? 'no session'}`);
    return { access_token: session.access_token, refresh_token: session.refresh_token, expires_in: session.expires_in };
}
