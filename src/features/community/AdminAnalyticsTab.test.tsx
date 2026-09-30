import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fillDailyGaps, type AnalyticsReport } from './analyticsService';

const { fetchAdminAnalytics } = vi.hoisted(() => ({ fetchAdminAnalytics: vi.fn() }));
vi.mock('./analyticsService', async () => ({
  ...(await vi.importActual<typeof import('./analyticsService')>('./analyticsService')),
  fetchAdminAnalytics,
}));

import { AdminAnalyticsTab } from './AdminAnalyticsTab';

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminAnalyticsTab />
    </QueryClientProvider>,
  );
}

const events = ['screen_view', 'signup_completed', 'guest_trip_started', 'guest_trip_saved', 'trip_created', 'place_added', 'document_uploaded', 'share_link_created', 'share_joined', 'onboarding_step_done', 'trip_limit_reached'].map(
  (event) => ({ event, events: 0, users: 0 }),
);

beforeEach(() => {
  fetchAdminAnalytics.mockReset();
});

describe('AdminAnalyticsTab', () => {
  it('연결된 PostHog는 방문자·전환율·일별·화면을, Sentry는 오류 목록을 보여 준다', async () => {
    const report: AnalyticsReport = {
      days: 7,
      generatedAt: '2026-09-30T01:00:00Z',
      posthog: {
        status: 'ok',
        dashboardUrl: 'https://us.posthog.com/project/1',
        events: events.map((e) =>
          e.event === 'screen_view' ? { ...e, users: 40, events: 200 } : e.event === 'trip_created' ? { ...e, users: 10, events: 12 } : e,
        ),
        daily: [{ day: '2026-09-29', users: 8, events: 40 }, { day: '2026-09-30', users: 12, events: 60 }],
        screens: [{ screen: 'plan_trip_list', views: 30 }],
      },
      sentry: {
        status: 'ok',
        dashboardUrl: 'https://sentry.io/organizations/x/issues/',
        issues: [{ id: '1', title: 'TypeError: x is undefined', culprit: null, level: 'error', count: 42, userCount: 3, lastSeen: '2026-09-30T01:00:00Z', permalink: 'https://sentry.io/issues/1/' }],
      },
    };
    fetchAdminAnalytics.mockResolvedValue(report);
    renderTab();
    expect(await screen.findByText('이용 분석 (PostHog)')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument(); // 여행 만들기 10명 / 방문 40명
    expect(screen.getByText('plan_trip_list')).toBeInTheDocument();
    expect(screen.getByText('TypeError: x is undefined').closest('a')).toHaveAttribute('href', 'https://sentry.io/issues/1/');
  });

  it('키를 안 넣은 쪽은 비어 있는 서버 환경 변수 이름만 안내한다', async () => {
    fetchAdminAnalytics.mockResolvedValue({
      days: 7,
      generatedAt: '2026-09-30T01:00:00Z',
      posthog: { status: 'not_configured', dashboardUrl: null, missing: ['POSTHOG_PERSONAL_API_KEY', 'POSTHOG_PROJECT_ID'] },
      sentry: { status: 'not_configured', dashboardUrl: null, missing: ['SENTRY_AUTH_TOKEN'] },
    } satisfies AnalyticsReport);
    renderTab();
    expect(await screen.findByText(/POSTHOG_PERSONAL_API_KEY, POSTHOG_PROJECT_ID/)).toBeInTheDocument();
    expect(screen.getByText(/SENTRY_AUTH_TOKEN/)).toBeInTheDocument();
  });

  it('불러오기 실패는 다시 시도 화면', async () => {
    fetchAdminAnalytics.mockRejectedValue(new Error('adminAnalytics HTTP 403'));
    renderTab();
    expect(await screen.findByText('분석 정보를 불러오지 못했어요')).toBeInTheDocument();
  });
});

describe('fillDailyGaps', () => {
  it('방문이 없던 날을 0으로 채워 최근 N일을 모두 만든다', () => {
    const out = fillDailyGaps([{ day: '2026-09-30', users: 3 }], 7, new Date('2026-09-30T05:00:00Z'));
    expect(out).toHaveLength(7);
    expect(out[0]).toEqual({ day: '2026-09-24', users: 0 });
    expect(out[6]).toEqual({ day: '2026-09-30', users: 3 });
  });

  it('데이터가 전혀 없어도 오늘까지 N일을 만든다', () => {
    const out = fillDailyGaps([], 30, new Date('2026-09-30T00:00:00Z'));
    expect(out).toHaveLength(30);
    expect(out.every((d) => d.users === 0)).toBe(true);
    expect(out[29].day).toBe('2026-09-30');
  });

  it('서버의 시간대가 앞서 내일 날짜가 오면 그 날짜를 끝으로 쓴다', () => {
    const out = fillDailyGaps([{ day: '2026-10-01', users: 2 }], 3, new Date('2026-09-30T20:00:00Z'));
    expect(out.map((d) => d.day)).toEqual(['2026-09-29', '2026-09-30', '2026-10-01']);
  });
});

describe('오류 원인 안내', () => {
  it('Sentry가 403이면 권한 안내를 보여 준다', async () => {
    fetchAdminAnalytics.mockResolvedValue({
      days: 7,
      generatedAt: '2026-09-30T01:00:00Z',
      posthog: { status: 'not_configured', dashboardUrl: null, missing: ['X'] },
      sentry: { status: 'error', dashboardUrl: 'https://sentry.io/x', httpStatus: 403 },
    } satisfies AnalyticsReport);
    renderTab();
    expect(await screen.findByText(/HTTP 403: 키에 권한이 부족해요/)).toBeInTheDocument();
  });
});
