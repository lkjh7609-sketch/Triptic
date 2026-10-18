// Apple 로그인 사용자가 탈퇴하면 Apple 토큰을 철회한다(App Store 심사 지침 5.1.1(v) — Sign in with Apple REST API /auth/revoke).
// 토큰은 탈퇴 직전 다시 로그인한 세션의 provider_refresh_token(없으면 provider_token)을 앱·웹이 보내 준다.
// client_secret은 Apple 로그인 키(.p8)로 서명한 ES256 JWT — 환경 변수 APPLE_TEAM_ID·APPLE_KEY_ID·APPLE_PRIVATE_KEY·APPLE_CLIENT_ID.
// APPLE_CLIENT_ID는 Supabase Apple 로그인에 넣은 Services ID(쉼표로 여러 개면 차례로 시도 — 토큰을 받은 ID여야 철회된다).
// 설정이 없거나 철회가 실패해도 탈퇴는 막지 않는다(결과만 돌려주고 기록).
import { createPrivateKey, sign } from 'node:crypto';

const REVOKE_URL = 'https://appleid.apple.com/auth/revoke';
const TOKEN_TYPES = new Set(['refresh_token', 'access_token']);

export function appleRevokeConfig(env = process.env) {
    const teamId = (env.APPLE_TEAM_ID || '').trim();
    const keyId = (env.APPLE_KEY_ID || '').trim();
    // 환경 변수에 줄바꿈을 \n 글자로 넣은 경우도 받는다
    const privateKey = (env.APPLE_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();
    const clientIds = (env.APPLE_CLIENT_ID || '').split(',').map((s) => s.trim()).filter(Boolean);
    const enabled = !!(teamId && keyId && privateKey && clientIds.length);
    return { enabled, teamId, keyId, privateKey, clientIds };
}

const b64url = (v) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');

/** Apple client_secret — ES256 JWT(5분짜리) */
export function appleClientSecret({ teamId, keyId, privateKey }, clientId, nowSec = Math.floor(Date.now() / 1000)) {
    const head = b64url({ alg: 'ES256', kid: keyId });
    const body = b64url({ iss: teamId, iat: nowSec, exp: nowSec + 300, aud: 'https://appleid.apple.com', sub: clientId });
    const input = `${head}.${body}`;
    const sig = sign('sha256', Buffer.from(input), { key: createPrivateKey(privateKey), dsaEncoding: 'ieee-p1363' });
    return `${input}.${sig.toString('base64url')}`;
}

/** 요청 본문에서 철회할 토큰을 꺼낸다 — 형식이 이상하면 null */
export function readAppleToken(body) {
    const token = typeof body?.appleToken === 'string' ? body.appleToken.trim() : '';
    if (!token || token.length > 4096) return null;
    const type = TOKEN_TYPES.has(body?.appleTokenType) ? body.appleTokenType : 'refresh_token';
    return { token, type };
}

/** 이 계정에 Apple 로그인이 연결돼 있는지 */
export function hasAppleIdentity(user) {
    if (user?.app_metadata?.provider === 'apple') return true;
    if (Array.isArray(user?.app_metadata?.providers) && user.app_metadata.providers.includes('apple')) return true;
    return Array.isArray(user?.identities) && user.identities.some((i) => i?.provider === 'apple');
}

/**
 * Apple 토큰 철회. 결과: { ok: true } | { ok: false, reason: 'not_configured' | 'no_token' | 'bad_key' | 'rejected' | 'network' }
 * Apple은 성공하면 200(이미 무효인 토큰도 200)을 준다.
 */
export async function revokeAppleToken(tokenInfo, { env = process.env, fetchImpl = fetch, timeoutMs = 5000 } = {}) {
    if (!tokenInfo?.token) return { ok: false, reason: 'no_token' };
    const config = appleRevokeConfig(env);
    if (!config.enabled) return { ok: false, reason: 'not_configured' };
    let reason = 'rejected';
    for (const clientId of config.clientIds) {
        let secret;
        try {
            secret = appleClientSecret(config, clientId);
        } catch {
            return { ok: false, reason: 'bad_key' }; // 키(.p8) 형식이 잘못됐다 — 다른 ID로 해도 같다
        }
        try {
            const form = new URLSearchParams({
                client_id: clientId,
                client_secret: secret,
                token: tokenInfo.token,
                token_type_hint: tokenInfo.type,
            });
            const res = await fetchImpl(REVOKE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: form.toString(),
                signal: AbortSignal.timeout(timeoutMs),
            });
            if (res.ok) return { ok: true };
            reason = 'rejected';
        } catch {
            reason = 'network';
        }
    }
    return { ok: false, reason };
}
