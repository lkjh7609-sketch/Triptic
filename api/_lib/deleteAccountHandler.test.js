import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireUser, deleteAccountData, maybeSingle, sendAccountDeletedMail, recordSuspension, pinConfig, verifyAdminPin } = vi.hoisted(() => ({
    requireUser: vi.fn(),
    deleteAccountData: vi.fn(),
    maybeSingle: vi.fn(),
    sendAccountDeletedMail: vi.fn(),
    recordSuspension: vi.fn(),
    pinConfig: vi.fn(),
    verifyAdminPin: vi.fn(),
}));
vi.mock('./suspension.js', async () => ({ ...(await vi.importActual('./suspension.js')), recordSuspension }));
vi.mock('./adminPin.js', async () => ({ ...(await vi.importActual('./adminPin.js')), pinConfig, verifyAdminPin }));
vi.mock('./accountMail.js', () => ({ sendAccountDeletedMail }));
vi.mock('./auth.js', () => ({ requireUser }));
vi.mock('./supabaseAdmin.js', () => ({ supabaseAdmin: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }) }) }));
vi.mock('./deleteAccount.js', async () => ({ ...(await vi.importActual('./deleteAccount.js')), deleteAccountData }));

import handler from '../deleteAccount.js';

function makeRes() {
    const res = { statusCode: 0, body: null };
    res.status = (c) => ((res.statusCode = c), res);
    res.json = (b) => ((res.body = b), res);
    res.end = () => res;
    res.setHeader = () => res;
    return res;
}
let ip = 0;
const post = (extra = {}) => ({ method: 'POST', headers: { origin: 'https://triptic.my', authorization: 'Bearer t', 'x-forwarded-for': `10.7.0.${++ip}` }, ...extra });
const fresh = () => new Date(Date.now() - 60_000).toISOString();

beforeEach(() => {
    requireUser.mockReset().mockResolvedValue({ id: 'u1', last_sign_in_at: fresh() });
    // 진짜 deleteAccountData처럼 before(이메일을 정지 명단에 올리기)를 먼저 끝낸다 — 실패하면 거기서 멈춘다
    deleteAccountData.mockReset().mockImplementation(async (_db, _id, opts) => {
        await opts?.before?.();
        return { files: 0 };
    });
    sendAccountDeletedMail.mockReset().mockResolvedValue(true);
    recordSuspension.mockReset().mockResolvedValue(true);
    maybeSingle.mockReset().mockResolvedValue({ data: { role: 'user' } });
    pinConfig.mockReset().mockReturnValue({ enabled: true, pin: '482915' });
    verifyAdminPin.mockReset().mockResolvedValue({ ok: true });
});

describe('POST /api/deleteAccount', () => {
    it('방금 로그인한 본인이면 삭제하고 200', async () => {
        const res = makeRes();
        await handler(post(), res);
        expect(res.statusCode).toBe(200);
        expect(deleteAccountData).toHaveBeenCalledWith(expect.anything(), 'u1');
    });

    it('삭제가 끝난 뒤 탈퇴 완료 메일을 보낸다(주소·언어·이름은 지우기 전 값)', async () => {
        requireUser.mockResolvedValue({ id: 'u1', email: 'a@b.co', last_sign_in_at: fresh() });
        maybeSingle.mockResolvedValue({ data: { role: 'user', display_name: '민지', locale: 'ja' } });
        const res = makeRes();
        await handler(post(), res);
        expect(res.statusCode).toBe(200);
        expect(sendAccountDeletedMail).toHaveBeenCalledWith({ email: 'a@b.co', locale: 'ja', name: '민지' });
        expect(deleteAccountData.mock.invocationCallOrder[0]).toBeLessThan(sendAccountDeletedMail.mock.invocationCallOrder[0]);
    });

    it('삭제가 실패하면 메일을 보내지 않는다', async () => {
        deleteAccountData.mockRejectedValue(new Error('boom'));
        const res = makeRes();
        await handler(post(), res);
        expect(res.statusCode).toBe(500);
        expect(sendAccountDeletedMail).not.toHaveBeenCalled();
    });

    it('로그인 토큰이 없으면 삭제하지 않는다(401은 requireUser가 응답)', async () => {
        requireUser.mockImplementation(async (_req, res) => (res.status(401).json({ error: 'login_required' }), null));
        const res = makeRes();
        await handler(post(), res);
        expect(res.statusCode).toBe(401);
        expect(deleteAccountData).not.toHaveBeenCalled();
    });

    it('오래된 세션(15분 넘게 전 로그인)은 다시 로그인하라고 403', async () => {
        requireUser.mockResolvedValue({ id: 'u1', last_sign_in_at: new Date(Date.now() - 3600_000).toISOString() });
        const res = makeRes();
        await handler(post(), res);
        expect(res.statusCode).toBe(403);
        expect(res.body).toEqual({ error: 'reauth_required' });
        expect(deleteAccountData).not.toHaveBeenCalled();
    });

    it('관리자 계정은 이 경로로 지우지 않는다', async () => {
        maybeSingle.mockResolvedValue({ data: { role: 'admin' } });
        const res = makeRes();
        await handler(post(), res);
        expect(res.statusCode).toBe(403);
        expect(res.body).toEqual({ error: 'admin_cannot_delete' });
        expect(deleteAccountData).not.toHaveBeenCalled();
    });

    it('출처가 없거나 허용 밖이면 403, POST가 아니면 405', async () => {
        const a = makeRes();
        await handler(post({ headers: { authorization: 'Bearer t', 'x-forwarded-for': `10.6.0.${++ip}` } }), a);
        const b = makeRes();
        await handler(post({ headers: { origin: 'https://evil.example', authorization: 'Bearer t', 'x-forwarded-for': `10.6.1.${++ip}` } }), b);
        const c = makeRes();
        await handler({ method: 'GET', headers: {} }, c);
        expect([a.statusCode, b.statusCode, c.statusCode]).toEqual([403, 403, 405]);
        expect(deleteAccountData).not.toHaveBeenCalled();
    });

    it('삭제 중 실패하면 500(상세는 응답에 안 담김)', async () => {
        deleteAccountData.mockRejectedValue(new Error('purge failed: fk secret detail'));
        const res = makeRes();
        await handler(post(), res);
        expect(res.statusCode).toBe(500);
        expect(JSON.stringify(res.body)).not.toContain('secret');
    });

    describe('운영자 강제 탈퇴', () => {
        const target = '11111111-1111-4111-8111-111111111111';
        const asAdmin = () => maybeSingle.mockResolvedValueOnce({ data: { role: 'admin' } });
        const adminPost = (body) => post({ body });

        it('사유와 함께 요청하면 이용 정지 명단에 올린 뒤에 지운다', async () => {
            asAdmin().mockResolvedValueOnce({ data: { role: 'user' } });
            const res = makeRes();
            await handler(adminPost({ targetUserId: target, reason: 'abuse' }), res);
            expect(res.statusCode).toBe(200);
            expect(recordSuspension).toHaveBeenCalledWith(expect.anything(), { userId: target, adminId: 'u1', reason: 'abuse', reasonText: null });
            // 정지 명단 기록은 계정 삭제 안에서 파일 삭제와 함께 돌되, 계정이 지워지기 전에 끝난다(deleteAccount.test.js에서 순서 확인)
            expect(deleteAccountData).toHaveBeenCalledWith(expect.anything(), target, { before: expect.any(Function) });
            expect(sendAccountDeletedMail).not.toHaveBeenCalled();
        });

        it('사유가 없거나 목록 밖이면 400이고 아무것도 지우지 않는다', async () => {
            for (const reason of [undefined, '', 'whatever']) {
                maybeSingle.mockReset();
                asAdmin().mockResolvedValueOnce({ data: { role: 'user' } });
                const res = makeRes();
                await handler(adminPost({ targetUserId: target, reason }), res);
                expect(res.statusCode).toBe(400);
                expect(res.body).toEqual({ error: 'bad_reason' });
            }
            expect(recordSuspension).not.toHaveBeenCalled();
            expect(deleteAccountData).not.toHaveBeenCalled();
        });

        it("직접 입력('custom')은 글을 함께 넘기고, 글이 없거나 200자를 넘으면 400", async () => {
            asAdmin().mockResolvedValueOnce({ data: { role: 'user' } });
            const ok = makeRes();
            await handler(adminPost({ targetUserId: target, reason: 'custom', reasonText: '  같은 글 반복  ' }), ok);
            expect(ok.statusCode).toBe(200);
            expect(recordSuspension).toHaveBeenCalledWith(expect.anything(), { userId: target, adminId: 'u1', reason: 'custom', reasonText: '같은 글 반복' });
            for (const reasonText of [undefined, '   ', 'a'.repeat(201)]) {
                maybeSingle.mockReset();
                asAdmin().mockResolvedValueOnce({ data: { role: 'user' } });
                const res = makeRes();
                await handler(adminPost({ targetUserId: target, reason: 'custom', reasonText }), res);
                expect(res.statusCode).toBe(400);
            }
            expect(deleteAccountData).toHaveBeenCalledTimes(1);
        });

        it('정지 명단에 못 올리면 500(계정 삭제 안에서 멈춘다)', async () => {
            recordSuspension.mockRejectedValue(new Error('insert failed'));
            asAdmin().mockResolvedValueOnce({ data: { role: 'user' } });
            const res = makeRes();
            await handler(adminPost({ targetUserId: target, reason: 'spam' }), res);
            expect(res.statusCode).toBe(500);
        });

        it('관리자가 아니면 403', async () => {
            const res = makeRes();
            await handler(adminPost({ targetUserId: target, reason: 'spam' }), res);
            expect(res.statusCode).toBe(403);
            expect(recordSuspension).not.toHaveBeenCalled();
        });

        describe('6자리 보안코드(15분 재로그인 대신)', () => {
            const stale = () => new Date(Date.now() - 3600_000).toISOString();
            const setup = () => asAdmin().mockResolvedValueOnce({ data: { role: 'user' } });

            it('오래전에 로그인한 관리자 세션이어도 보안코드가 맞으면 탈퇴시킨다', async () => {
                requireUser.mockResolvedValue({ id: 'u1', last_sign_in_at: stale() });
                setup();
                const res = makeRes();
                await handler(adminPost({ targetUserId: target, reason: 'abuse', pin: '482915' }), res);
                expect(res.statusCode).toBe(200);
                expect(verifyAdminPin).toHaveBeenCalledWith(expect.anything(), '482915');
                expect(deleteAccountData).toHaveBeenCalledTimes(1);
            });

            it('보안코드가 틀리면 남은 횟수를 알려 주고 아무것도 지우지 않는다', async () => {
                verifyAdminPin.mockResolvedValue({ ok: false, status: 401, body: { error: 'wrong_pin', attemptsLeft: 3 } });
                setup();
                const res = makeRes();
                await handler(adminPost({ targetUserId: target, reason: 'abuse', pin: '000111' }), res);
                expect(res.statusCode).toBe(401);
                expect(res.body).toEqual({ error: 'wrong_pin', attemptsLeft: 3 });
                expect(recordSuspension).not.toHaveBeenCalled();
                expect(deleteAccountData).not.toHaveBeenCalled();
            });

            it('잠겨 있으면 429와 남은 시간을 그대로 돌려준다', async () => {
                verifyAdminPin.mockResolvedValue({ ok: false, status: 429, body: { error: 'locked', retryAfter: 600 } });
                setup();
                const res = makeRes();
                await handler(adminPost({ targetUserId: target, reason: 'abuse', pin: '482915' }), res);
                expect(res.statusCode).toBe(429);
                expect(res.body).toEqual({ error: 'locked', retryAfter: 600 });
                expect(deleteAccountData).not.toHaveBeenCalled();
            });

            it('사유·대상이 잘못된 요청은 보안코드 시도를 세지 않는다(코드 검사 전에 걸러 낸다)', async () => {
                setup();
                const res = makeRes();
                await handler(adminPost({ targetUserId: target, reason: 'whatever', pin: '482915' }), res);
                expect(res.statusCode).toBe(400);
                expect(verifyAdminPin).not.toHaveBeenCalled();
            });

            it('보안코드가 꺼져 있으면(ADMIN_PIN 미설정) 예전처럼 15분 안에 로그인한 세션만 받는다', async () => {
                pinConfig.mockReturnValue({ enabled: false, reason: 'not_configured' });
                requireUser.mockResolvedValue({ id: 'u1', last_sign_in_at: stale() });
                setup();
                const old = makeRes();
                await handler(adminPost({ targetUserId: target, reason: 'abuse' }), old);
                expect(old.statusCode).toBe(403);
                expect(old.body).toEqual({ error: 'reauth_required' });
                expect(deleteAccountData).not.toHaveBeenCalled();

                requireUser.mockResolvedValue({ id: 'u1', last_sign_in_at: fresh() });
                setup();
                const recent = makeRes();
                await handler(adminPost({ targetUserId: target, reason: 'abuse' }), recent);
                expect(recent.statusCode).toBe(200);
                expect(verifyAdminPin).not.toHaveBeenCalled();
            });

            it('본인 탈퇴는 보안코드와 상관없이 방금 로그인한 세션만(그대로)', async () => {
                requireUser.mockResolvedValue({ id: 'u1', last_sign_in_at: stale() });
                const res = makeRes();
                await handler(post({ body: { pin: '482915' } }), res);
                expect(res.statusCode).toBe(403);
                expect(res.body).toEqual({ error: 'reauth_required' });
                expect(deleteAccountData).not.toHaveBeenCalled();
            });
        });
    });
});
