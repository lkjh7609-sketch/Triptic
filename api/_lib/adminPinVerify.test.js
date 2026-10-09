import { describe, expect, it, vi } from 'vitest';
import { verifyAdminPin } from './adminPin.js';

const ENV = { ADMIN_PIN: '482915' };

/** admin_pin_begin / admin_pin_reset만 흉내 내는 가짜 DB */
function fakeDb(begin) {
    const rpc = vi.fn(async (name) => {
        if (name === 'admin_pin_begin') return begin;
        return { data: null, error: null };
    });
    return { rpc };
}
const allowed = (attemptNo = 1) => ({ data: [{ allowed: true, attempt_no: attemptNo, retry_after: 0 }], error: null });

describe('verifyAdminPin', () => {
    it('맞으면 ok이고 틀린 횟수를 지운다', async () => {
        const db = fakeDb(allowed());
        expect(await verifyAdminPin(db, '482915', { env: ENV })).toEqual({ ok: true });
        expect(db.rpc).toHaveBeenCalledWith('admin_pin_reset');
    });

    it('reset: false면 지우지 않는다(로그인은 세션을 만든 뒤에 지운다)', async () => {
        const db = fakeDb(allowed());
        await verifyAdminPin(db, '482915', { env: ENV, reset: false });
        expect(db.rpc).not.toHaveBeenCalledWith('admin_pin_reset');
    });

    it('틀리면 401과 남은 횟수 — 지우지 않는다', async () => {
        const db = fakeDb(allowed(2));
        const r = await verifyAdminPin(db, '000111', { env: ENV });
        expect(r).toEqual({ ok: false, status: 401, body: { error: 'wrong_pin', attemptsLeft: 3 } });
        expect(db.rpc).not.toHaveBeenCalledWith('admin_pin_reset');
    });

    it('5번째로 틀리면 남은 횟수 0과 잠금 시간(15분)', async () => {
        const r = await verifyAdminPin(fakeDb(allowed(5)), '000111', { env: ENV });
        expect(r.body).toEqual({ error: 'wrong_pin', attemptsLeft: 0, retryAfter: 900 });
    });

    it('잠겨 있으면 코드를 보지 않고 429', async () => {
        const db = fakeDb({ data: [{ allowed: false, attempt_no: 0, retry_after: 540 }], error: null });
        const r = await verifyAdminPin(db, '482915', { env: ENV });
        expect(r).toEqual({ ok: false, status: 429, body: { error: 'locked', retryAfter: 540 } });
        expect(db.rpc).not.toHaveBeenCalledWith('admin_pin_reset');
    });

    it('잠금을 확인하지 못하면 시도를 받지 않는다(닫힌 쪽으로 실패)', async () => {
        const r = await verifyAdminPin(fakeDb({ data: null, error: { message: 'boom' } }), '482915', { env: ENV });
        expect(r).toEqual({ ok: false, status: 503, body: { error: 'lock_unavailable' } });
    });

    it('보안코드를 쓸 수 없게 꺼져 있으면 503, 형식이 틀리면 400 — 둘 다 시도를 세지 않는다', async () => {
        const db = fakeDb(allowed());
        expect((await verifyAdminPin(db, '482915', { env: {} })).body).toEqual({ error: 'pin_disabled' });
        expect((await verifyAdminPin(db, '12', { env: ENV })).body).toEqual({ error: 'bad_format' });
        expect((await verifyAdminPin(db, undefined, { env: ENV })).body).toEqual({ error: 'bad_format' });
        expect(db.rpc).not.toHaveBeenCalled();
    });
});
