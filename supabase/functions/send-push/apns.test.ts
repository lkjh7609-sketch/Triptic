import { describe, expect, it } from 'vitest';
import { apnsHost, base64url, buildPayload, classifyApnsResponse, importApnsKey, safePath, signProviderToken } from './apns';
import { commentMessage, normalizeLocale, replyMessage, tripReminderMessage } from './messages';

function toPem(pkcs8: ArrayBuffer): string {
  const b64 = btoa(String.fromCharCode(...new Uint8Array(pkcs8)));
  return `-----BEGIN PRIVATE KEY-----\n${b64.match(/.{1,64}/g)!.join('\n')}\n-----END PRIVATE KEY-----\n`;
}

describe('APNs 공급자 토큰(JWT, ES256)', () => {
  it('p8(PEM)을 읽어 서명하고, 공개 키로 검증된다 — 헤더에 키 ID, 본문에 팀 ID·시각', async () => {
    const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
    const pem = toPem(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
    const key = await importApnsKey(pem);
    const jwt = await signProviderToken(key, 'KEY1234567', 'TEAM123456', 1_790_000_000);
    const [h, c, s] = jwt.split('.');
    const decode = (part: string) => JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
    expect(decode(h)).toEqual({ alg: 'ES256', kid: 'KEY1234567' });
    expect(decode(c)).toEqual({ iss: 'TEAM123456', iat: 1_790_000_000 });
    const sig = Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - (s.length % 4)) % 4)), (ch) => ch.charCodeAt(0));
    expect(sig.length).toBe(64); // r‖s (JWT가 요구하는 형식)
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pair.publicKey, sig, new TextEncoder().encode(`${h}.${c}`));
    expect(ok).toBe(true);
  });

  it('base64url — +/=가 없다', () => {
    expect(base64url('???>>>')).toBe('Pz8_Pj4-');
    expect(base64url(new Uint8Array([251, 255, 254]))).toBe('-__-');
  });
});

describe('본문·경로', () => {
  it('제목·본문을 자르고, 앱 안 경로만 싣는다', () => {
    const p = JSON.parse(buildPayload({ title: 'T'.repeat(200), body: 'B'.repeat(400), path: '/community/post/abc#comment-1' }));
    expect(p.aps.alert.title).toHaveLength(80);
    expect(p.aps.alert.body).toHaveLength(160);
    expect(p.aps.sound).toBe('default');
    expect(p.path).toBe('/community/post/abc#comment-1');
  });

  it('바깥 주소·이상한 경로는 버린다', () => {
    for (const bad of ['https://evil.com', '//evil.com', 'javascript:alert(1)', '/a b', '/<script>', 42, undefined, '/' + 'x'.repeat(250)]) {
      expect(safePath(bad)).toBeUndefined();
      expect(JSON.parse(buildPayload({ title: 't', body: 'b', path: bad as string })).path).toBeUndefined();
    }
    expect(safePath('/plan/1c9e')).toBe('/plan/1c9e');
  });
});

describe('APNs 응답 해석', () => {
  it('200이면 보냄', () => expect(classifyApnsResponse(200)).toBe('sent'));
  it('쓸 수 없는 기기 토큰은 지운다', () => {
    expect(classifyApnsResponse(410, 'Unregistered')).toBe('remove-token');
    expect(classifyApnsResponse(400, 'BadDeviceToken')).toBe('remove-token');
    expect(classifyApnsResponse(400, 'DeviceTokenNotForTopic')).toBe('remove-token');
  });
  it('인증 토큰 만료·서버 바쁨은 나중에', () => {
    expect(classifyApnsResponse(403, 'ExpiredProviderToken')).toBe('retry-later');
    expect(classifyApnsResponse(429, 'TooManyRequests')).toBe('retry-later');
    expect(classifyApnsResponse(503)).toBe('retry-later');
  });
  it('그 밖(잘못된 요청 등)은 실패', () => expect(classifyApnsResponse(400, 'PayloadEmpty')).toBe('fail'));
  it('개발용만 sandbox 주소', () => {
    expect(apnsHost(undefined)).toBe('https://api.push.apple.com');
    expect(apnsHost('production')).toBe('https://api.push.apple.com');
    expect(apnsHost('sandbox')).toBe('https://api.sandbox.push.apple.com');
  });
});

describe('푸시 문구', () => {
  it('언어를 고르고(기본 한국어) 글 내용은 담지 않는다', () => {
    expect(normalizeLocale(null)).toBe('ko');
    expect(normalizeLocale('ja-JP')).toBe('ja');
    expect(normalizeLocale('zh-TW')).toBe('zh-TW');
    expect(normalizeLocale('fr')).toBe('en');
    expect(commentMessage('ko', '민수')).toEqual({ title: '새 댓글', body: '민수님이 내 글에 댓글을 남겼어요' });
    expect(replyMessage('en', 'Ann')).toEqual({ title: 'New reply', body: 'Ann replied to your comment' });
    expect(tripReminderMessage('ko', '도쿄 3박 4일').title).toBe('3일 뒤 출발이에요');
    expect(tripReminderMessage('zh-TW', 'X').body).toContain('X');
  });
});
