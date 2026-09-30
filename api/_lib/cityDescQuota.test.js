import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireUser, chatCompletion, state } = vi.hoisted(() => ({
    requireUser: vi.fn(),
    chatCompletion: vi.fn(),
    state: { cached: null, quota: { allowed: true, used: 1 }, rpcCalls: 0 },
}));
vi.mock('./auth.js', () => ({ requireUser }));
vi.mock('./llm.js', () => ({ chatCompletion, hasLlmProvider: () => true }));
vi.mock('./supabaseAdmin.js', () => ({
    supabaseAdmin: () => ({
        from: (table) =>
            table === 'profiles'
                ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { plan: 'free', role: 'user' } }) }) }) }
                : {
                      select: () => ({ match: () => ({ maybeSingle: async () => ({ data: state.cached ? { payload: { description: state.cached } } : null, error: null }) }) }),
                      upsert: async () => ({ error: null }),
                  },
        rpc: async () => {
            state.rpcCalls++;
            return { data: [state.quota], error: null };
        },
    }),
}));

import handler from '../cityDesc.js';

function makeRes() {
    const res = { statusCode: 0, body: null };
    res.status = (c) => ((res.statusCode = c), res);
    res.json = (b) => ((res.body = b), res);
    res.end = () => res;
    res.setHeader = () => res;
    return res;
}
let ip = 0;
const get = () => ({ method: 'GET', headers: { 'x-forwarded-for': `10.5.0.${++ip}` }, query: { city: 'Paris', locale: 'en' } });

beforeEach(() => {
    requireUser.mockReset().mockResolvedValue({ id: 'u1' });
    chatCompletion.mockReset().mockResolvedValue({ content: 'Paris is lovely.', provider: 'x', model: 'm' });
    state.cached = null;
    state.quota = { allowed: true, used: 1 };
    state.rpcCalls = 0;
});

describe('/api/cityDesc — 하루 한도', () => {
    it('캐시에 있으면 한도를 쓰지 않고 LLM도 안 부른다', async () => {
        state.cached = 'Cached text';
        const res = makeRes();
        await handler(get(), res);
        expect(res.statusCode).toBe(200);
        expect(res.body.cached).toBe(true);
        expect(state.rpcCalls).toBe(0);
        expect(chatCompletion).not.toHaveBeenCalled();
    });

    it('캐시에 없으면 한도 1회를 쓰고 LLM을 부른다', async () => {
        const res = makeRes();
        await handler(get(), res);
        expect(res.statusCode).toBe(200);
        expect(state.rpcCalls).toBe(1);
        expect(chatCompletion).toHaveBeenCalledTimes(1);
    });

    it('한도를 넘으면 429(daily_limit)이고 LLM을 부르지 않는다', async () => {
        state.quota = { allowed: false, used: 10 };
        const res = makeRes();
        await handler(get(), res);
        expect(res.statusCode).toBe(429);
        expect(res.body).toEqual({ error: 'daily_limit', limit: 10 });
        expect(chatCompletion).not.toHaveBeenCalled();
    });
});
