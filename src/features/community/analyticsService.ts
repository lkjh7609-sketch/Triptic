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
