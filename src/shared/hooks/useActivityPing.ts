import { useEffect } from 'react';
import { apiUrl } from '@/shared/api/apiUrl';
import { getSupabaseClient } from '@/shared/api/supabaseClient';

/** 같은 기기에서 이만큼은 다시 기록하지 않는다 */
export const PING_INTERVAL_MS = 30 * 60 * 1000;
const KEY_PREFIX = 'triptic-activity-ping:';

export function shouldPing(lastPingAt: number | null, now: number): boolean {
  return lastPingAt === null || Number.isNaN(lastPingAt) || now - lastPingAt >= PING_INTERVAL_MS;
}

function readLast(userId: string): number | null {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + userId);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

function writeLast(userId: string, at: number) {
  try {
    localStorage.setItem(KEY_PREFIX + userId, String(at));
  } catch {
    // 저장이 막혀도 기록 자체는 한다(다음 접속에 또 기록될 뿐)
  }
}

async function ping(userId: string) {
  writeLast(userId, Date.now());
  // 접속 국가만(/api/geo — 헤더의 국가 코드, IP는 저장·반환 안 함). 못 받으면 접속 시각만 기록한다
  let country: string | null = null;
  try {
    const res = await fetch(apiUrl('/api/geo'), { cache: 'no-store' });
    if (res.ok) country = ((await res.json()) as { country?: string | null }).country ?? null;
  } catch {
    // 국가 없이 진행
  }
  await getSupabaseClient().rpc('touch_my_activity', { p_country: country, p_city: null });
}

/**
 * 로그인한 회원이 앱을 열면(그리고 30분 넘게 지나 다시 돌아오면) 최근 접속 시각과 접속 국가를 서버에 남긴다(0088).
 * 운영자 회원 관리에서만 보이고, 정확한 위치는 모으지 않는다. 실패해도 화면에는 영향이 없다.
 */
export function useActivityPing(userId: string | null | undefined) {
  useEffect(() => {
    if (!userId) return;
    const run = () => {
      if (!shouldPing(readLast(userId), Date.now())) return;
      void ping(userId).catch(() => {});
    };
    run();
    const onVisible = () => {
      if (document.visibilityState === 'visible') run();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [userId]);
}
