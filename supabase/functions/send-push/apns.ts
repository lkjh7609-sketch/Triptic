/**
 * Apple 푸시(APNs) 발송 도우미 — 순수 계산(서명·본문·응답 해석)만 둔다. 실제 호출은 index.ts.
 * 인증은 공급자 토큰(JWT, ES256): 헤더 {alg, kid=키 ID}, 본문 {iss=팀 ID, iat}, 최대 60분 재사용(Apple은 20분 이상 ~ 60분 미만 사이 갱신을 요구).
 */

const encoder = new TextEncoder();

export function base64url(bytes: Uint8Array | string): string {
  const data = typeof bytes === 'string' ? encoder.encode(bytes) : bytes;
  let binary = '';
  for (const b of data) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** AuthKey_XXXX.p8(PEM, PKCS#8) → 서명 키 */
export async function importApnsKey(pem: string): Promise<CryptoKey> {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s+/g, '');
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

/** 공급자 토큰(JWT). WebCrypto의 ECDSA 서명은 JWT가 요구하는 r‖s 형식 그대로다 */
export async function signProviderToken(key: CryptoKey, keyId: string, teamId: string, nowSec: number): Promise<string> {
  const header = base64url(JSON.stringify({ alg: 'ES256', kid: keyId }));
  const claims = base64url(JSON.stringify({ iss: teamId, iat: nowSec }));
  const input = `${header}.${claims}`;
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(input)));
  return `${input}.${base64url(signature)}`;
}

export interface PushMessage {
  title: string;
  body: string;
  /** 눌렀을 때 앱 안에서 열 경로(예: /community/post/…) — '/'로 시작하는 우리 앱 경로만 */
  path?: string;
}

/** 앱 안 경로만 허용 — 바깥 주소·이상한 값이면 버린다 */
export function safePath(path: unknown): string | undefined {
  return typeof path === 'string' && /^\/[A-Za-z0-9/_\-#?=&.%]*$/.test(path) && !path.startsWith('//') && path.length <= 200 ? path : undefined;
}

/** APNs 본문(JSON) — 잠금 화면에 보이는 제목·본문은 글 내용을 담지 않는다 */
export function buildPayload(message: PushMessage): string {
  const path = safePath(message.path);
  return JSON.stringify({
    aps: { alert: { title: message.title.slice(0, 80), body: message.body.slice(0, 160) }, sound: 'default' },
    ...(path ? { path } : {}),
  });
}

export type ApnsOutcome = 'sent' | 'remove-token' | 'retry-later' | 'fail';

/**
 * APNs 응답 해석 — 200이면 보냄, 기기 토큰이 더는 쓸 수 없으면(410 Unregistered / 400 BadDeviceToken·DeviceTokenNotForTopic) 토큰 삭제,
 * 인증 토큰이 틀렸거나 서버가 바쁘면 나중에 다시, 그 밖은 실패.
 */
export function classifyApnsResponse(status: number, reason?: string): ApnsOutcome {
  if (status === 200) return 'sent';
  if (status === 410 || reason === 'Unregistered' || reason === 'BadDeviceToken' || reason === 'DeviceTokenNotForTopic') return 'remove-token';
  if (status === 429 || status >= 500 || reason === 'ExpiredProviderToken' || reason === 'TooManyProviderTokenUpdates') return 'retry-later';
  return 'fail';
}

export function apnsHost(env: string | undefined): string {
  return env === 'sandbox' ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com';
}
