import { describe, expect, it, vi } from 'vitest';
import { ALLOWED_DAYS, fetchPosthogReport, fetchSentryReport, posthogConfig, sentryConfig } from './analytics.js';

const PH = { POSTHOG_PERSONAL_API_KEY: 'k', POSTHOG_PROJECT_ID: '636703' };
const SE = { SENTRY_AUTH_TOKEN: 't', SENTRY_ORG: 'triptic-kg', SENTRY_PROJECT: 'javascript-react' };

function jsonRes(body, ok = true, status = 200) {
    return { ok, status, json: async () => body };
}

describe('설정 확인', () => {
    it('빠진 환경 변수 이름을 알려 준다(값은 아님)', () => {
        expect(posthogConfig({}).missing).toEqual(['POSTHOG_PERSONAL_API_KEY', 'POSTHOG_PROJECT_ID']);
        expect(posthogConfig({ POSTHOG_PERSONAL_API_KEY: 'k', POSTHOG_PROJECT_ID: 'abc' }).missing).toEqual(['POSTHOG_PROJECT_ID']);
        expect(sentryConfig({}).missing).toEqual(['SENTRY_AUTH_TOKEN', 'SENTRY_ORG', 'SENTRY_PROJECT']);
        expect(sentryConfig({ ...SE, SENTRY_PROJECT: '../x' }).missing).toEqual(['SENTRY_PROJECT']);
    });

    it('호스트는 https 도메인만 받고 이상한 값이면 기본값', () => {
        expect(posthogConfig({ ...PH, POSTHOG_API_HOST: 'http://evil.example' }).host).toBe('https://us.posthog.com');
        expect(posthogConfig({ ...PH, POSTHOG_API_HOST: 'https://eu.posthog.com/' }).host).toBe('https://eu.posthog.com');
    });
});

describe('fetchPosthogReport', () => {
    it('키가 없으면 연결 전 — 외부 호출 없음', async () => {
        const f = vi.fn();
        const r = await fetchPosthogReport(7, {}, f);
        expect(r.status).toBe('not_configured');
        expect(r.missing).toContain('POSTHOG_PERSONAL_API_KEY');
        expect(f).not.toHaveBeenCalled();
    });

    it('이벤트별 사용자·횟수를 매핑하고, 없는 이벤트는 0으로 채운다', async () => {
        const f = vi
            .fn()
            .mockResolvedValueOnce(jsonRes({ results: [['trip_created', 5, 3], ['screen_view', 100, 20]] }))
            .mockResolvedValueOnce(jsonRes({ results: [['2026-09-29', 8, 40], ['2026-09-30', 12, 60]] }))
            .mockResolvedValueOnce(jsonRes({ results: [['plan_trip_list', 30], [null, 2]] }));
        const r = await fetchPosthogReport(7, PH, f);
        expect(r.status).toBe('ok');
        expect(r.dashboardUrl).toBe('https://us.posthog.com/project/636703');
        expect(r.events.find((e) => e.event === 'trip_created')).toEqual({ event: 'trip_created', events: 5, users: 3 });
        expect(r.events.find((e) => e.event === 'document_uploaded')).toEqual({ event: 'document_uploaded', events: 0, users: 0 });
        expect(r.daily).toEqual([{ day: '2026-09-29', users: 8, events: 40 }, { day: '2026-09-30', users: 12, events: 60 }]);
        expect(r.screens).toEqual([{ screen: 'plan_trip_list', views: 30 }]);
        // 인증 헤더와 프로젝트 주소, 기간은 정수로만 들어간다
        const [url, init] = f.mock.calls[0];
        expect(url).toBe('https://us.posthog.com/api/projects/636703/query/');
        expect(init.headers.Authorization).toBe('Bearer k');
        expect(JSON.parse(init.body).query.query).toContain('interval 7 day');
    });

    it('허용되지 않은 기간은 거부한다(SQL에 들어가지 않게)', async () => {
        await expect(fetchPosthogReport('7; drop table', PH, vi.fn())).rejects.toThrow('invalid days');
        await expect(fetchPosthogReport(1000, PH, vi.fn())).rejects.toThrow('invalid days');
    });

    it('PostHog가 오류를 내면 error로만 알리고 상세는 새지 않는다', async () => {
        const f = vi.fn().mockResolvedValue(jsonRes({ detail: 'secret detail' }, false, 401));
        const r = await fetchPosthogReport(30, PH, f);
        expect(r.status).toBe('error');
        expect(r.httpStatus).toBe(401);
        expect(JSON.stringify(r)).not.toContain('secret');
    });
});

describe('fetchSentryReport', () => {
    it('키가 없으면 연결 전', async () => {
        const r = await fetchSentryReport(7, {}, vi.fn());
        expect(r.status).toBe('not_configured');
    });

    it('미해결 오류를 필요한 필드만 뽑아 돌려준다', async () => {
        const f = vi.fn().mockResolvedValue(
            jsonRes([
                { id: '1', title: 'TypeError: x is undefined', culprit: 'src/a.ts', level: 'error', count: '42', userCount: 3, lastSeen: '2026-09-30T01:00:00Z', permalink: 'https://triptic-kg.sentry.io/issues/1/', extra: 'ignored' },
                { id: '2', title: 'bad link', permalink: 'javascript:alert(1)' },
            ]),
        );
        const r = await fetchSentryReport(7, SE, f);
        expect(r.status).toBe('ok');
        expect(r.issues[0]).toEqual({
            id: '1', title: 'TypeError: x is undefined', culprit: 'src/a.ts', level: 'error', count: 42, userCount: 3,
            lastSeen: '2026-09-30T01:00:00Z', permalink: 'https://triptic-kg.sentry.io/issues/1/',
        });
        expect(r.issues[1].permalink).toBeNull();
        const [url, init] = f.mock.calls[0];
        expect(url).toContain('/api/0/projects/triptic-kg/javascript-react/issues/');
        expect(decodeURIComponent(url)).toContain('query=is:unresolved lastSeen:-7d');
        expect(url).not.toContain('statsPeriod');
        expect(init.headers.Authorization).toBe('Bearer t');
    });

    it('Sentry 오류는 error로만 알리고, 상대 서버의 HTTP 상태 번호만 덧붙인다', async () => {
        const r = await fetchSentryReport(7, SE, vi.fn().mockRejectedValue(new Error('network')));
        expect(r.status).toBe('error');
        expect(r.httpStatus).toBeNull();
        const denied = await fetchSentryReport(7, SE, vi.fn().mockResolvedValue(jsonRes({ detail: 'secret detail' }, false, 403)));
        expect(denied).toMatchObject({ status: 'error', httpStatus: 403 });
        expect(JSON.stringify(denied)).not.toContain('secret');
    });
});

it('허용 기간', () => {
    expect(ALLOWED_DAYS).toEqual([7, 30, 90]);
});
