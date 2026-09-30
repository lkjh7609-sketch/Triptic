import { describe, expect, it, vi } from 'vitest';
import { AI_DAILY_LIMIT, AI_KIND, DailyLimitError, limitFor, takeAiQuota } from './aiQuota.js';

function fakeDb({ profile = { plan: 'free', role: 'user' }, rpcResult = { data: [{ allowed: true, used: 1 }], error: null } } = {}) {
    return {
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile }) }) }) }),
        rpc: vi.fn(async () => rpcResult),
    };
}

describe('limitFor', () => {
    it('무료 10, 프로 100, 운영자는 프로와 같다', () => {
        expect(limitFor({ plan: 'free', role: 'user' })).toBe(AI_DAILY_LIMIT.free);
        expect(limitFor({ plan: 'pro', role: 'user' })).toBe(AI_DAILY_LIMIT.pro);
        expect(limitFor({ plan: 'free', role: 'admin' })).toBe(AI_DAILY_LIMIT.pro);
        expect(limitFor(null)).toBe(AI_DAILY_LIMIT.free);
        expect(AI_DAILY_LIMIT).toEqual({ free: 10, pro: 100 });
    });
});

describe('takeAiQuota', () => {
    it('통과하면 한도와 사용량을 돌려주고, 사용자·종류·한도·출처를 DB 함수에 넘긴다', async () => {
        const db = fakeDb({ profile: { plan: 'pro', role: 'user' }, rpcResult: { data: [{ allowed: true, used: 7 }], error: null } });
        expect(await takeAiQuota(db, 'u1', 'recommend')).toEqual({ limit: 100, used: 7 });
        expect(db.rpc).toHaveBeenCalledWith('take_daily_quota', { p_user_id: 'u1', p_kind: AI_KIND, p_limit: 100, p_meta: { endpoint: 'recommend' } });
    });

    it('한도를 넘으면 DailyLimitError(한도·사용량 포함)', async () => {
        const db = fakeDb({ rpcResult: { data: [{ allowed: false, used: 10 }], error: null } });
        await expect(takeAiQuota(db, 'u1', 'cityDesc')).rejects.toMatchObject({ name: 'DailyLimitError', limit: 10, used: 10 });
        await expect(takeAiQuota(db, 'u1', 'cityDesc')).rejects.toBeInstanceOf(DailyLimitError);
    });

    it('확인할 수 없으면(DB 없음·오류·빈 결과) 통과시키지 않는다', async () => {
        await expect(takeAiQuota(null, 'u1', 'x')).rejects.toThrow('quota unavailable');
        await expect(takeAiQuota(fakeDb({ rpcResult: { data: null, error: { message: 'down' } } }), 'u1', 'x')).rejects.toThrow('quota unavailable');
        await expect(takeAiQuota(fakeDb({ rpcResult: { data: [], error: null } }), 'u1', 'x')).rejects.toThrow('quota unavailable');
    });
});
