import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getUser, maybeSingle, fetchPosthogReport, fetchSentryReport } = vi.hoisted(() => ({
    getUser: vi.fn(),
    maybeSingle: vi.fn(),
    fetchPosthogReport: vi.fn(),
    fetchSentryReport: vi.fn(),
}));
vi.mock('./supabaseAdmin.js', () => ({
    supabaseAdmin: () => ({
        auth: { getUser },
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
    }),
}));
vi.mock('./analytics.js', () => ({ ALLOWED_DAYS: [7, 30, 90], fetchPosthogReport, fetchSentryReport }));

import handler from '../adminAnalytics.js';

function makeRes() {
    const res = { statusCode: 0, body: null, headers: {} };
    res.status = (c) => ((res.statusCode = c), res);
    res.json = (b) => ((res.body = b), res);
    res.end = () => res;
    res.setHeader = (k, v) => ((res.headers[k] = v), res);
    return res;
}
let ip = 0;
const req = (extra = {}) => ({ method: 'GET', headers: { authorization: 'Bearer tok', origin: '', 'x-forwarded-for': `10.0.0.${++ip}` }, query: {}, ...extra });

beforeEach(() => {
    getUser.mockReset();
    maybeSingle.mockReset();
    fetchPosthogReport.mockReset().mockResolvedValue({ status: 'ok' });
    fetchSentryReport.mockReset().mockResolvedValue({ status: 'not_configured', missing: ['SENTRY_ORG'] });
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'x';
});

describe('adminAnalytics', () => {
    it('토큰이 없으면 403', async () => {
        const res = makeRes();
        await handler(req({ headers: { 'x-forwarded-for': `10.1.0.${++ip}` } }), res);
        expect(res.statusCode).toBe(403);
        expect(fetchPosthogReport).not.toHaveBeenCalled();
    });

    it('관리자가 아니면 403이고 외부 API는 부르지 않는다', async () => {
        getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null });
        maybeSingle.mockResolvedValue({ data: { role: 'user' } });
        const res = makeRes();
        await handler(req(), res);
        expect(res.statusCode).toBe(403);
        expect(fetchPosthogReport).not.toHaveBeenCalled();
        expect(fetchSentryReport).not.toHaveBeenCalled();
    });

    it('허용되지 않은 기간은 400', async () => {
        getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null });
        maybeSingle.mockResolvedValue({ data: { role: 'admin' } });
        const res = makeRes();
        await handler(req({ query: { days: '5' } }), res);
        expect(res.statusCode).toBe(400);
    });

    it('관리자면 두 요약을 함께 돌려준다(한쪽이 미연결이어도)', async () => {
        getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null });
        maybeSingle.mockResolvedValue({ data: { role: 'admin' } });
        const res = makeRes();
        await handler(req({ query: { days: '30' } }), res);
        expect(res.statusCode).toBe(200);
        expect(res.body.days).toBe(30);
        expect(res.body.posthog.status).toBe('ok');
        expect(res.body.sentry).toEqual({ status: 'not_configured', missing: ['SENTRY_ORG'] });
        expect(res.headers['Cache-Control']).toBe('private, no-store');
    });

    it('성공한 결과는 1분 동안 다시 부르지 않고, 미연결은 매번 다시 확인한다', async () => {
        getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null });
        maybeSingle.mockResolvedValue({ data: { role: 'admin' } });
        await handler(req({ query: { days: '90' } }), makeRes());
        await handler(req({ query: { days: '90' } }), makeRes());
        expect(fetchPosthogReport).toHaveBeenCalledTimes(1);
        expect(fetchSentryReport).toHaveBeenCalledTimes(2);
    });
});
