import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireUser, deleteAccountData, maybeSingle, sendAccountDeletedMail, recordSuspension } = vi.hoisted(() => ({
    requireUser: vi.fn(),
    deleteAccountData: vi.fn(),
    maybeSingle: vi.fn(),
    sendAccountDeletedMail: vi.fn(),
    recordSuspension: vi.fn(),
}));
vi.mock('./suspension.js', async () => ({ ...(await vi.importActual('./suspension.js')), recordSuspension }));
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
    deleteAccountData.mockReset().mockResolvedValue({ files: 0 });
    sendAccountDeletedMail.mockReset().mockResolvedValue(true);
    recordSuspension.mockReset().mockResolvedValue(true);
    maybeSingle.mockReset().mockResolvedValue({ data: { role: 'user' } });
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
            expect(recordSuspension).toHaveBeenCalledWith(expect.anything(), { userId: target, adminId: 'u1', reason: 'abuse' });
            expect(recordSuspension.mock.invocationCallOrder[0]).toBeLessThan(deleteAccountData.mock.invocationCallOrder[0]);
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

        it('정지 명단에 못 올리면 지우지 않고 500', async () => {
            recordSuspension.mockRejectedValue(new Error('insert failed'));
            asAdmin().mockResolvedValueOnce({ data: { role: 'user' } });
            const res = makeRes();
            await handler(adminPost({ targetUserId: target, reason: 'spam' }), res);
            expect(res.statusCode).toBe(500);
            expect(deleteAccountData).not.toHaveBeenCalled();
        });

        it('관리자가 아니면 403', async () => {
            const res = makeRes();
            await handler(adminPost({ targetUserId: target, reason: 'spam' }), res);
            expect(res.statusCode).toBe(403);
            expect(recordSuspension).not.toHaveBeenCalled();
        });
    });
});
