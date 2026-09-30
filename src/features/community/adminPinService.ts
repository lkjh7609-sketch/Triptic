import { apiUrl } from '@/shared/api/apiUrl';
import { getSupabaseClient } from '@/shared/api/supabaseClient';

export interface PinStatus {
  enabled: boolean;
  locked: boolean;
  retryAfter: number;
}

export type PinResult =
  | { ok: true }
  | { ok: false; kind: 'wrong'; attemptsLeft: number; retryAfter?: number }
  | { ok: false; kind: 'locked'; retryAfter: number }
  | { ok: false; kind: 'disabled' }
  | { ok: false; kind: 'error' };

/** 비밀번호 로그인을 쓸 수 있는지, 지금 잠겨 있는지 — 시도 횟수는 세지 않는다 */
export async function fetchPinStatus(): Promise<PinStatus> {
  try {
    const res = await fetch(apiUrl('/api/adminPin'), { cache: 'no-store' });
    if (!res.ok) return { enabled: false, locked: false, retryAfter: 0 };
    return (await res.json()) as PinStatus;
  } catch {
    return { enabled: false, locked: false, retryAfter: 0 };
  }
}

/**
 * 6자리 숫자를 서버에 보낸다. 맞으면 서버가 관리자 계정의 로그인 세션을 내려 주고, 여기서 그 세션으로 로그인 상태가 된다
 * (이후 관리 기능은 관리자로 로그인했을 때와 똑같이 동작한다). 값은 이 함수 밖에 저장하지 않는다.
 */
export async function submitAdminPin(pin: string): Promise<PinResult> {
  try {
    const res = await fetch(apiUrl('/api/adminPin'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
      cache: 'no-store',
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      attemptsLeft?: number;
      retryAfter?: number;
      session?: { access_token: string; refresh_token: string };
    };
    if (res.ok && json.session) {
      const { error } = await getSupabaseClient().auth.setSession({
        access_token: json.session.access_token,
        refresh_token: json.session.refresh_token,
      });
      return error ? { ok: false, kind: 'error' } : { ok: true };
    }
    if (json.error === 'wrong_pin') return { ok: false, kind: 'wrong', attemptsLeft: json.attemptsLeft ?? 0, retryAfter: json.retryAfter };
    if (json.error === 'locked') return { ok: false, kind: 'locked', retryAfter: json.retryAfter ?? 900 };
    if (json.error === 'pin_disabled') return { ok: false, kind: 'disabled' };
    return { ok: false, kind: 'error' };
  } catch {
    return { ok: false, kind: 'error' };
  }
}

/** 초 → "m:ss" */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
