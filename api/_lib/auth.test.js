import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUser = vi.fn();
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { getUser } }) }));

import { requireUser } from './auth.js';

function makeRes() {
    const res = { statusCode: 0, body: null };
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
    res.json = (body) => {
        res.body = body;
        return res;
    };
    return res;
}

beforeEach(() => {
    getUser.mockReset();
    process.env.SUPABASE_URL = 'https://x.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon';
});

describe('requireUser', () => {
    it('토큰이 없으면 401', async () => {
        const res = makeRes();
        expect(await requireUser({ headers: {} }, res)).toBeNull();
        expect(res.statusCode).toBe(401);
        expect(res.body).toEqual({ error: 'login_required' });
        expect(getUser).not.toHaveBeenCalled();
    });

    it('Bearer 형식이 아니면 401', async () => {
        const res = makeRes();
        expect(await requireUser({ headers: { authorization: 'Basic abc' } }, res)).toBeNull();
        expect(res.statusCode).toBe(401);
    });

    it('유효하지 않은 토큰이면 401', async () => {
        getUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad jwt' } });
        const res = makeRes();
        expect(await requireUser({ headers: { authorization: 'Bearer bad' } }, res)).toBeNull();
        expect(res.statusCode).toBe(401);
    });

    it('유효한 토큰이면 사용자를 돌려주고 응답은 건드리지 않는다', async () => {
        getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
        const res = makeRes();
        const user = await requireUser({ headers: { authorization: 'Bearer good' } }, res);
        expect(user).toEqual({ id: 'u1' });
        expect(res.statusCode).toBe(0);
        expect(getUser).toHaveBeenCalledWith('good');
    });

    it('Supabase 설정이 없으면 503', async () => {
        delete process.env.SUPABASE_URL;
        delete process.env.NEXT_PUBLIC_SUPABASE_URL;
        const res = makeRes();
        expect(await requireUser({ headers: { authorization: 'Bearer good' } }, res)).toBeNull();
        expect(res.statusCode).toBe(503);
    });

    it('검증 중 예외가 나면 503', async () => {
        getUser.mockRejectedValue(new Error('network'));
        const res = makeRes();
        expect(await requireUser({ headers: { authorization: 'Bearer good' } }, res)).toBeNull();
        expect(res.statusCode).toBe(503);
    });
});
