// Vercel Serverless Function: 회원 탈퇴 — 즉시 삭제
// POST /api/deleteAccount   Authorization: Bearer <Supabase access token>
//
// 본문에 targetUserId가 있으면 운영자가 그 회원을 강제 탈퇴시킨다(관리자 세션만, 관리자 계정·본인은 대상 불가) — 함수 개수 한도 때문에 같은 파일을 쓴다.
// 강제 탈퇴에는 사유(reason, 'custom'이면 reasonText도)와 관리자 6자리 보안코드(pin)가 필요하다. 보안코드는 로그인 키패드와 같은 검사·같은 잠금을 쓴다
// (5번 틀리면 15분 잠금, 전역). 그 이메일은 이용 정지 명단에 올라 같은 이메일로 다시 들어오지 못한다(0095, 운영자가 해제 가능).
// 보안코드를 쓸 수 없게 꺼져 있으면(ADMIN_PIN 미설정) 예전처럼 방금(15분 안) 다시 로그인한 세션만 받는다.
// 본인 탈퇴는 방금(15분 안) 다시 로그인한 본인의 세션만 받는다. 저장소 파일 → DB 데이터(여행·서류·게시글·동행 기록 등, 되돌릴 수 없음) → 로그인 계정 순서로
// 지우고, 성공하면 200. 관리자 계정은 이 경로로 지우지 않는다. 도중에 실패하면 500을 주고, 다시 요청하면 이어서 끝난다.
import { applyCors, createRateLimiter, ALLOWED_ORIGINS } from './_lib/http.js';
import { requireUser } from './_lib/auth.js';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { deleteAccountData, isRecentlySignedIn } from './_lib/deleteAccount.js';
import { sendAccountDeletedMail } from './_lib/accountMail.js';
import { pinConfig, verifyAdminPin } from './_lib/adminPin.js';
import { isSuspensionReason, normalizeReasonText, recordSuspension } from './_lib/suspension.js';

const isRateLimited = createRateLimiter(6);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
    applyCors(req, res, 'POST,OPTIONS', 'Content-Type, Authorization');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

    const origin = req.headers.origin;
    if (!origin || !ALLOWED_ORIGINS.has(origin)) return res.status(403).json({ error: 'forbidden' });
    if (isRateLimited(req)) return res.status(429).json({ error: 'rate_limited' });

    const user = await requireUser(req, res);
    if (!user) return;

    const db = supabaseAdmin();
    if (!db) return res.status(503).json({ error: 'server_unavailable' });

    const targetUserId = typeof req.body?.targetUserId === 'string' ? req.body.targetUserId : null;
    // 요청한 사람과 (강제 탈퇴라면) 대상의 등급을 한꺼번에 읽는다 — 하나씩 읽으면 그만큼 느려진다
    const [{ data: profile }, { data: target }] = await Promise.all([
        db.from('profiles').select('role, display_name, locale').eq('id', user.id).maybeSingle(),
        targetUserId && UUID_RE.test(targetUserId) ? db.from('profiles').select('role').eq('id', targetUserId).maybeSingle() : Promise.resolve({ data: null }),
    ]);

    // 운영자의 강제 탈퇴
    if (targetUserId) {
        if (profile?.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
        if (!UUID_RE.test(targetUserId) || targetUserId === user.id) return res.status(400).json({ error: 'bad_target' });
        if (target?.role === 'admin') return res.status(403).json({ error: 'admin_cannot_delete' });
        const reason = req.body?.reason;
        if (!isSuspensionReason(reason)) return res.status(400).json({ error: 'bad_reason' });
        // '직접 입력'이면 운영자가 쓴 글(1~200자)이 사유가 된다
        const reasonText = normalizeReasonText(reason, req.body?.reasonText);
        if (reasonText === undefined) return res.status(400).json({ error: 'bad_reason' });

        // 되돌릴 수 없는 일이라 마지막에 한 번 더 확인한다 — 6자리 보안코드(입력이 틀린 요청은 코드 시도를 헛되이 세지 않도록 위에서 먼저 걸러 냈다)
        if (pinConfig().enabled) {
            const checked = await verifyAdminPin(db, req.body?.pin);
            if (!checked.ok) return res.status(checked.status).json(checked.body);
        } else if (!isRecentlySignedIn(user.last_sign_in_at)) {
            return res.status(403).json({ error: 'reauth_required' });
        }

        try {
            // 이메일은 계정을 지우면 읽을 수 없으니 정지 명단에 먼저 올린다(파일 삭제와 한꺼번에 하되 계정 삭제 전에 끝난다. 도중에 실패해 다시 요청해도 안전)
            await deleteAccountData(db, targetUserId, { before: () => recordSuspension(db, { userId: targetUserId, adminId: user.id, reason, reasonText }) });
            console.info('[deleteAccount] admin removed member', targetUserId);
            return res.status(200).json({ ok: true });
        } catch (e) {
            console.warn('[deleteAccount] admin removal failed:', e instanceof Error ? e.message : 'unknown');
            return res.status(500).json({ error: 'delete_failed' });
        }
    }

    // 본인 탈퇴 — 방금 다시 로그인한 세션만
    if (!isRecentlySignedIn(user.last_sign_in_at)) return res.status(403).json({ error: 'reauth_required' });
    if (profile?.role === 'admin') return res.status(403).json({ error: 'admin_cannot_delete' });

    try {
        await deleteAccountData(db, user.id);
        // 탈퇴 완료 안내 메일 — 본인이 직접 탈퇴한 경우만(운영자 강제 탈퇴는 보내지 않는다). 실패해도 탈퇴는 이미 끝났으니 결과는 그대로 200
        await sendAccountDeletedMail({ email: user.email, locale: profile?.locale, name: profile?.display_name });
        return res.status(200).json({ ok: true });
    } catch (e) {
        console.warn('[deleteAccount] failed:', e instanceof Error ? e.message : 'unknown');
        return res.status(500).json({ error: 'delete_failed' });
    }
}
