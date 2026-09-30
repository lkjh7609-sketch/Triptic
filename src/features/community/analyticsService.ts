import { apiUrl } from '@/shared/api/apiUrl';
import { getSupabaseClient } from '@/shared/api/supabaseClient';

export const ANALYTICS_RANGES = [7, 30, 90] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export interface PosthogEventStat {
  event: string;
  events: number;
  users: number;
}

export type SourceStatus = 'ok' | 'not_configured' | 'error';

export interface PosthogReport {
  status: SourceStatus;
  dashboardUrl: string | null;
  /** 오류일 때 상대 서버가 돌려준 HTTP 상태 번호(없으면 연결 자체가 안 됨) */
  httpStatus?: number | null;
  /** 연결 전일 때 비어 있는 서버 환경 변수 이름(값 아님) */
  missing?: string[];
  events?: PosthogEventStat[];
  daily?: Array<{ day: string; users: number; events: number }>;
  screens?: Array<{ screen: string; views: number }>;
}

export interface SentryIssue {
  id: string;
  title: string;
  culprit: string | null;
  level: string;
  count: number;
  userCount: number;
  lastSeen: string | null;
  permalink: string | null;
}

export interface SentryReport {
  status: SourceStatus;
  dashboardUrl: string | null;
  httpStatus?: number | null;
  /** 401일 때만 — 토큰 값이 아니라 모양(길이·알려진 접두사·앞뒤 잡글자 여부)만 */
  tokenHint?: { length: number; prefix: string | null; hadJunk: boolean };
  missing?: string[];
  issues?: SentryIssue[];
}

export interface AnalyticsReport {
  days: number;
  generatedAt: string;
  posthog: PosthogReport;
  sentry: SentryReport;
}

/** 운영 콘솔 "분석" 탭 — 서버(api/adminAnalytics.js)가 관리자 확인 후 PostHog·Sentry에서 읽어 온다 */
export async function fetchAdminAnalytics(days: AnalyticsRange): Promise<AnalyticsReport> {
  const { data } = await getSupabaseClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('adminAnalytics: not signed in');
  const res = await fetch(apiUrl(`/api/adminAnalytics?days=${days}`), { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`adminAnalytics HTTP ${res.status}`);
  return (await res.json()) as AnalyticsReport;
}

/** 방문자 대비 비율(0~100, 소수 첫째 자리). 방문자가 0이면 null */
export function percentOf(users: number, visitors: number): number | null {
  if (visitors <= 0) return null;
  return Math.round((users / visitors) * 1000) / 10;
}

/**
 * 일별 방문자에서 빠진 날(그날 방문이 0)을 0으로 채워 최근 days일을 모두 보여 준다 — 안 채우면 하루만 있을 때
 * 막대 하나가 전체 폭을 채워 그래프처럼 안 보인다. 끝 날짜는 서버가 준 마지막 날과 오늘(UTC) 중 늦은 쪽.
 */
export function fillDailyGaps(
  daily: Array<{ day: string; users: number }>,
  days: number,
  today: Date = new Date(),
): Array<{ day: string; users: number }> {
  const todayKey = today.toISOString().slice(0, 10);
  const lastKey = daily.length > 0 ? daily[daily.length - 1].day : todayKey;
  const end = new Date(`${lastKey > todayKey ? lastKey : todayKey}T00:00:00Z`);
  const byDay = new Map(daily.map((d) => [d.day, d.users]));
  const out: Array<{ day: string; users: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = new Date(end.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    out.push({ day: key, users: byDay.get(key) ?? 0 });
  }
  return out;
}
