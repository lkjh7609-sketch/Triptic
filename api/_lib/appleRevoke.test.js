import { generateKeyPairSync, verify } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { appleClientSecret, appleRevokeConfig, hasAppleIdentity, readAppleToken, revokeAppleToken } from './appleRevoke.js';

// 시험용으로 그 자리에서 만든 키(실제 Apple 키 아님)
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const env = { APPLE_TEAM_ID: 'TEAM123', APPLE_KEY_ID: 'KEY123', APPLE_PRIVATE_KEY: pem.replace(/\n/g, '\\n'), APPLE_CLIENT_ID: 'com.example.web' };

describe('appleRevokeConfig', () => {
    it('네 값이 다 있어야 켜진다, 줄바꿈을 \\n 글자로 넣어도 받는다', () => {
        expect(appleRevokeConfig({}).enabled).toBe(false);
        const c = appleRevokeConfig(env);
        expect(c.enabled).toBe(true);
        expect(c.privateKey).toContain('\n');
        expect(appleRevokeConfig({ ...env, APPLE_CLIENT_ID: 'a, b' }).clientIds).toEqual(['a', 'b']);
    });
});

describe('appleClientSecret', () => {
    it('ES256 JWT — 머리·내용이 맞고 서명이 공개키로 검증된다', () => {
        const jwt = appleClientSecret(appleRevokeConfig(env), 'com.example.web', 1_000_000);
        const [h, b, s] = jwt.split('.');
        expect(JSON.parse(Buffer.from(h, 'base64url'))).toEqual({ alg: 'ES256', kid: 'KEY123' });
        expect(JSON.parse(Buffer.from(b, 'base64url'))).toEqual({ iss: 'TEAM123', iat: 1_000_000, exp: 1_000_300, aud: 'https://appleid.apple.com', sub: 'com.example.web' });
        expect(verify('sha256', Buffer.from(`${h}.${b}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url'))).toBe(true);
    });
});

describe('readAppleToken / hasAppleIdentity', () => {
    it('토큰 형식 검사, 종류는 refresh_token 기본', () => {
        expect(readAppleToken({})).toBeNull();
        expect(readAppleToken({ appleToken: 'x'.repeat(5000) })).toBeNull();
        expect(readAppleToken({ appleToken: 'r1' })).toEqual({ token: 'r1', type: 'refresh_token' });
        expect(readAppleToken({ appleToken: 'a1', appleTokenType: 'access_token' })).toEqual({ token: 'a1', type: 'access_token' });
        expect(readAppleToken({ appleToken: 'a1', appleTokenType: 'weird' })).toEqual({ token: 'a1', type: 'refresh_token' });
    });
    it('Apple 연결 여부 — provider·providers·identities 중 하나', () => {
        expect(hasAppleIdentity({ app_metadata: { provider: 'apple' } })).toBe(true);
        expect(hasAppleIdentity({ app_metadata: { provider: 'google', providers: ['google', 'apple'] } })).toBe(true);
        expect(hasAppleIdentity({ identities: [{ provider: 'apple' }] })).toBe(true);
        expect(hasAppleIdentity({ app_metadata: { provider: 'email' }, identities: [{ provider: 'email' }] })).toBe(false);
    });
});

describe('revokeAppleToken', () => {
    it('Apple /auth/revoke에 client_id·client_secret·token·hint를 보낸다', async () => {
        const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
        await expect(revokeAppleToken({ token: 'r1', type: 'refresh_token' }, { env, fetchImpl })).resolves.toEqual({ ok: true });
        const [url, init] = fetchImpl.mock.calls[0];
        expect(url).toBe('https://appleid.apple.com/auth/revoke');
        const form = new URLSearchParams(init.body);
        expect(form.get('client_id')).toBe('com.example.web');
        expect(form.get('token')).toBe('r1');
        expect(form.get('token_type_hint')).toBe('refresh_token');
        expect(form.get('client_secret').split('.')).toHaveLength(3);
    });
    it('Services ID가 여러 개면 성공할 때까지 차례로', async () => {
        const fetchImpl = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true });
        const r = await revokeAppleToken({ token: 'r1', type: 'refresh_token' }, { env: { ...env, APPLE_CLIENT_ID: 'a,b' }, fetchImpl });
        expect(r).toEqual({ ok: true });
        expect(new URLSearchParams(fetchImpl.mock.calls[1][1].body).get('client_id')).toBe('b');
    });
    it('설정 없음·토큰 없음·키 오류·거절·네트워크 오류는 이유와 함께 실패(던지지 않음)', async () => {
        const fetchImpl = vi.fn();
        expect(await revokeAppleToken({ token: 'r1' }, { env: {}, fetchImpl })).toEqual({ ok: false, reason: 'not_configured' });
        expect(await revokeAppleToken(null, { env, fetchImpl })).toEqual({ ok: false, reason: 'no_token' });
        expect(await revokeAppleToken({ token: 'r1' }, { env: { ...env, APPLE_PRIVATE_KEY: 'nope' }, fetchImpl })).toEqual({ ok: false, reason: 'bad_key' });
        expect(fetchImpl).not.toHaveBeenCalled();
        expect(await revokeAppleToken({ token: 'r1' }, { env, fetchImpl: vi.fn().mockResolvedValue({ ok: false }) })).toEqual({ ok: false, reason: 'rejected' });
        expect(await revokeAppleToken({ token: 'r1' }, { env, fetchImpl: vi.fn().mockRejectedValue(new Error('x')) })).toEqual({ ok: false, reason: 'network' });
    });
});
