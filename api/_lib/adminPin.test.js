import { beforeEach, describe, expect, it, vi } from 'vitest';

const { verifyOtp } = vi.hoisted(() => ({ verifyOtp: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { verifyOtp } }) }));

import { isWeakPin, mintAdminSession, pinConfig, pinMatches } from './adminPin.js';

describe('pinConfig / isWeakPin', () => {
    it('6자리 숫자가 아니거나 없으면 꺼진다', () => {
        for (const v of [undefined, '', '12345', '1234567', 'abc123', '12 456']) {
            expect(pinConfig({ ADMIN_PIN: v }).enabled, String(v)).toBe(false);
        }
        expect(pinConfig({ ADMIN_PIN: '' }).reason).toBe('not_configured');
    });

    it('뻔한 값은 꺼진다(같은 숫자·연속·흔한 패턴)', () => {
        for (const v of ['000000', '111111', '123456', '654321', '234567', '121212', '112233']) {
            expect(isWeakPin(v), v).toBe(true);
            expect(pinConfig({ ADMIN_PIN: v })).toEqual({ enabled: false, reason: 'weak' });
        }
    });

    it('그 밖의 6자리 숫자는 켜진다', () => {
        expect(pinConfig({ ADMIN_PIN: ' 385204 ' })).toEqual({ enabled: true, pin: '385204' });
        expect(isWeakPin('385204')).toBe(false);
    });
});

describe('pinMatches', () => {
    it('같으면 true, 다르면 false', () => {
        expect(pinMatches('385204', '385204')).toBe(true);
        expect(pinMatches('385205', '385204')).toBe(false);
    });
});

function fakeDb({ admins = [{ id: 'a1' }], email = 'admin@example.com', hashed = 'hash1' } = {}) {
    return {
        from: () => ({ select: () => ({ eq: async () => ({ data: admins, error: null }) }) }),
        auth: {
            admin: {
                getUserById: async () => ({ data: { user: email ? { email } : {} }, error: null }),
                generateLink: async () => ({ data: hashed ? { properties: { hashed_token: hashed } } : {}, error: null }),
            },
        },
    };
}
const ENV = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon' };

describe('mintAdminSession', () => {
    beforeEach(() => verifyOtp.mockReset());

    it('관리자 계정이 1개면 세션(access/refresh)을 돌려준다', async () => {
        verifyOtp.mockResolvedValue({ data: { session: { access_token: 'acc', refresh_token: 'ref', expires_in: 3600 } }, error: null });
        expect(await mintAdminSession(fakeDb(), ENV)).toEqual({ access_token: 'acc', refresh_token: 'ref', expires_in: 3600 });
        expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'hash1', type: 'magiclink' });
    });

    it('관리자가 0명이거나 여럿이면 발급하지 않는다(닫힌 쪽으로 실패)', async () => {
        await expect(mintAdminSession(fakeDb({ admins: [] }), ENV)).rejects.toThrow('exactly one admin');
        await expect(mintAdminSession(fakeDb({ admins: [{ id: 'a' }, { id: 'b' }] }), ENV)).rejects.toThrow('exactly one admin');
        expect(verifyOtp).not.toHaveBeenCalled();
    });

    it('이메일이 없거나 링크·토큰 확인이 실패하면 발급하지 않는다', async () => {
        await expect(mintAdminSession(fakeDb({ email: null }), ENV)).rejects.toThrow('no email');
        await expect(mintAdminSession(fakeDb({ hashed: null }), ENV)).rejects.toThrow('generateLink');
        verifyOtp.mockResolvedValue({ data: {}, error: { message: 'expired' } });
        await expect(mintAdminSession(fakeDb(), ENV)).rejects.toThrow('verifyOtp');
    });

    it('Supabase 설정이 없으면 발급하지 않는다', async () => {
        await expect(mintAdminSession(fakeDb(), {})).rejects.toThrow('supabase env missing');
    });
});
