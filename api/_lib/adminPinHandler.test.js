import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc, mint } = vi.hoisted(() => ({ rpc: vi.fn(), mint: vi.fn() }));
vi.mock('./supabaseAdmin.js', () => ({ supabaseAdmin: () => ({ rpc }) }));
vi.mock('./adminPin.js', async () => ({ ...(await vi.importActual('./adminPin.js')), mintAdminSession: mint }));

import handler from '../adminPin.js';

function makeRes() {
    const res = { statusCode: 0, body: null, headers: {} };
    res.status = (c) => ((res.statusCode = c), res);
    res.json = (b) => ((res.body = b), res);
    res.end = () => res;
    res.setHeader = (k, v) => ((res.headers[k] = v), res);
    return res;
}
let ip = 0;
const post = (pin, extra = {}) => ({
    method: 'POST',
    headers: { origin: 'https://triptic.my', 'x-forwarded-for': `10.9.0.${++ip}` },
    body: { pin },
    ...extra,
});

beforeEach(() => {
    rpc.mockReset();
    mint.mockReset();
    process.env.ADMIN_PIN = '385204';
});

describe('POST /api/adminPin', () => {
    it('맞는 PIN이면 세션을 주고 잠금 횟수를 초기화한다', async () => {
        rpc.mockImplementation(async (name) => (name === 'admin_pin_begin' ? { data: [{ allowed: true, retry_after: 0, attempt_no: 1 }] } : { data: null }));
        mint.mockResolvedValue({ access_token: 'a', refresh_token: 'r', expires_in: 3600 });
        const res = makeRes();
        await handler(post('385204'), res);
        expect(res.statusCode).toBe(200);
        expect(res.body.session.access_token).toBe('a');
        expect(rpc).toHaveBeenCalledWith('admin_pin_reset');
        expect(res.headers['Cache-Control']).toBe('no-store');
    });

    it('틀리면 401과 남은 횟수, 세션은 발급하지 않는다', async () => {
        rpc.mockResolvedValue({ data: [{ allowed: true, retry_after: 0, attempt_no: 2 }] });
        const res = makeRes();
        await handler(post('000001'), res);
        expect(res.statusCode).toBe(401);
        expect(res.body).toEqual({ error: 'wrong_pin', attemptsLeft: 3 });
        expect(mint).not.toHaveBeenCalled();
    });

    it('5번째로 틀리면 남은 횟수 0과 잠금 시간을 알린다', async () => {
        rpc.mockResolvedValue({ data: [{ allowed: true, retry_after: 0, attempt_no: 5 }] });
        const res = makeRes();
        await handler(post('000001'), res);
        expect(res.body).toEqual({ error: 'wrong_pin', attemptsLeft: 0, retryAfter: 900 });
    });

    it('잠겨 있으면 PIN이 맞아도 검사하지 않고 429 — 세션을 주지 않는다', async () => {
        rpc.mockResolvedValue({ data: [{ allowed: false, retry_after: 840, attempt_no: 5 }] });
        const res = makeRes();
        await handler(post('385204'), res); // 정답을 보내도
        expect(res.statusCode).toBe(429);
        expect(res.body).toEqual({ error: 'locked', retryAfter: 840 });
        expect(mint).not.toHaveBeenCalled();
    });

    it('잠금을 확인하지 못하면(DB 오류) 시도를 받지 않는다', async () => {
        rpc.mockResolvedValue({ data: null, error: { message: 'down' } });
        const res = makeRes();
        await handler(post('385204'), res);
        expect(res.statusCode).toBe(503);
        expect(mint).not.toHaveBeenCalled();
    });

    it('형식이 틀리면 400 — 잠금 횟수를 쓰지 않는다', async () => {
        for (const pin of ['12345', 'abcdef', '', 123456, null]) {
            const res = makeRes();
            await handler(post(pin), res);
            expect(res.statusCode, String(pin)).toBe(400);
        }
        expect(rpc).not.toHaveBeenCalled();
    });

    it('출처가 없거나 허용 목록 밖이면 403', async () => {
        const res1 = makeRes();
        await handler(post('385204', { headers: { 'x-forwarded-for': `10.8.0.${++ip}` } }), res1);
        const res2 = makeRes();
        await handler(post('385204', { headers: { origin: 'https://evil.example', 'x-forwarded-for': `10.8.1.${++ip}` } }), res2);
        expect([res1.statusCode, res2.statusCode]).toEqual([403, 403]);
        expect(rpc).not.toHaveBeenCalled();
    });

    it('ADMIN_PIN이 없거나 뻔하면 503(PIN 로그인이 꺼진다)', async () => {
        for (const v of [undefined, '123456', '12ab56']) {
            if (v === undefined) delete process.env.ADMIN_PIN;
            else process.env.ADMIN_PIN = v;
            const res = makeRes();
            await handler(post('385204'), res);
            expect(res.statusCode, String(v)).toBe(503);
        }
        expect(rpc).not.toHaveBeenCalled();
    });

    it('PIN은 맞는데 세션 발급이 실패하면 503 — 세션 없음', async () => {
        rpc.mockResolvedValue({ data: [{ allowed: true, retry_after: 0, attempt_no: 1 }] });
        mint.mockRejectedValue(new Error('expected exactly one admin, found 2'));
        const res = makeRes();
        await handler(post('385204'), res);
        expect(res.statusCode).toBe(503);
        expect(res.body).toEqual({ error: 'session_failed' });
    });
});

describe('GET /api/adminPin', () => {
    it('잠금 상태를 알려 주고 시도 횟수는 세지 않는다', async () => {
        rpc.mockResolvedValue({ data: [{ locked: true, retry_after: 600 }] });
        const res = makeRes();
        await handler({ method: 'GET', headers: {} }, res);
        expect(res.body).toEqual({ enabled: true, locked: true, retryAfter: 600 });
        expect(rpc).toHaveBeenCalledWith('admin_pin_status');
        expect(rpc).not.toHaveBeenCalledWith('admin_pin_begin', expect.anything());
    });

    it('PIN이 꺼져 있으면 enabled=false', async () => {
        delete process.env.ADMIN_PIN;
        const res = makeRes();
        await handler({ method: 'GET', headers: {} }, res);
        expect(res.body.enabled).toBe(false);
    });
});
