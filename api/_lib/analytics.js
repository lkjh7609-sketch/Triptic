// 운영 콘솔 "분석" 탭용 — PostHog(이용 분석)·Sentry(오류)에서 요약을 읽어 온다.
// 키는 전부 서버 환경 변수(VITE_ 아님 — 브라우저에 실리면 안 되는 개인 API 키/토큰)에만 둔다:
//   PostHog: POSTHOG_PERSONAL_API_KEY(개인 API 키, "Query: Read" 권한), POSTHOG_PROJECT_ID, POSTHOG_API_HOST(기본 https://us.posthog.com)
//   Sentry : SENTRY_AUTH_TOKEN(Project·Issue&Event·Organization 읽기), SENTRY_ORG, SENTRY_PROJECT(슬러그), SENTRY_API_HOST(기본 https://sentry.io)
// 사용자에게서 받은 값은 SQL이나 주소에 들어가지 않는다 — 기간(days)은 허용 목록의 정수, 이벤트 이름은 아래 상수.

export const ALLOWED_DAYS = [7, 30, 90];

/** 분석 이벤트 이름 — src/shared/monitoring.ts의 AnalyticsEvent와 같은 목록 */
const EVENTS = [
    'screen_view',
    'signup_completed',
    'guest_trip_started',
    'guest_trip_saved',
    'trip_created',
    'place_added',
    'document_uploaded',
    'share_link_created',
    'share_joined',
    'onboarding_step_done',
    'trip_limit_reached',
];

const SLUG = /^[A-Za-z0-9_.-]+$/;
const ID = /^\d+$/;

function hostOf(value, fallback) {
    const host = (value || fallback).replace(/\/+$/, '');
    return /^https:\/\/[A-Za-z0-9.-]+$/.test(host) ? host : fallback;
}

export function posthogConfig(env = process.env) {
    const missing = [];
    if (!env.POSTHOG_PERSONAL_API_KEY) missing.push('POSTHOG_PERSONAL_API_KEY');
    if (!env.POSTHOG_PROJECT_ID || !ID.test(env.POSTHOG_PROJECT_ID)) missing.push('POSTHOG_PROJECT_ID');
    if (missing.length) return { missing };
    return {
        missing,
        key: env.POSTHOG_PERSONAL_API_KEY,
        projectId: env.POSTHOG_PROJECT_ID,
        host: hostOf(env.POSTHOG_API_HOST, 'https://us.posthog.com'),
    };
}

export function sentryConfig(env = process.env) {
    const missing = [];
    if (!env.SENTRY_AUTH_TOKEN) missing.push('SENTRY_AUTH_TOKEN');
    if (!env.SENTRY_ORG || !SLUG.test(env.SENTRY_ORG)) missing.push('SENTRY_ORG');
    if (!env.SENTRY_PROJECT || !SLUG.test(env.SENTRY_PROJECT)) missing.push('SENTRY_PROJECT');
    if (missing.length) return { missing };
    return {
        missing,
        token: env.SENTRY_AUTH_TOKEN,
        org: env.SENTRY_ORG,
        project: env.SENTRY_PROJECT,
        host: hostOf(env.SENTRY_API_HOST, 'https://sentry.io'),
    };
}

async function hogql(cfg, sql, fetchImpl) {
    const res = await fetchImpl(`${cfg.host}/api/projects/${cfg.projectId}/query/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: { kind: 'HogQLQuery', query: sql } }),
    });
    if (!res.ok) throw new Error(`posthog HTTP ${res.status}`);
    const json = await res.json();
    return Array.isArray(json?.results) ? json.results : [];
}

/** 최근 days일 — 이벤트별 사용자·횟수, 일별 방문자, 많이 본 화면 */
export async function fetchPosthogReport(days, env = process.env, fetchImpl = fetch) {
    const cfg = posthogConfig(env);
    const base = { dashboardUrl: cfg.missing?.length ? null : `${cfg.host}/project/${cfg.projectId}` };
    if (cfg.missing.length) return { ...base, status: 'not_configured', missing: cfg.missing };
    const n = Number(days);
    if (!ALLOWED_DAYS.includes(n)) throw new Error('invalid days');
    const list = EVENTS.map((e) => `'${e}'`).join(', ');
    const since = `timestamp >= now() - interval ${n} day`;
    try {
        const [eventRows, dayRows, screenRows] = await Promise.all([
            hogql(cfg, `select event, count() as events, count(distinct person_id) as users from events where ${since} and event in (${list}) group by event`, fetchImpl),
            hogql(cfg, `select toString(toDate(timestamp)) as day, count(distinct person_id) as users, count() as events from events where ${since} and event = 'screen_view' group by day order by day`, fetchImpl),
            hogql(cfg, `select properties.screen as screen, count() as views from events where ${since} and event = 'screen_view' group by screen order by views desc limit 10`, fetchImpl),
        ]);
        const byEvent = Object.fromEntries(eventRows.map(([event, events, users]) => [event, { events: Number(events), users: Number(users) }]));
        return {
            ...base,
            status: 'ok',
            // 이벤트가 하나도 없는 것도 0으로 채워서, 화면이 "빠졌다"와 "0건"을 구분할 수 있게
            events: EVENTS.map((event) => ({ event, events: byEvent[event]?.events ?? 0, users: byEvent[event]?.users ?? 0 })),
            daily: dayRows.map(([day, users, events]) => ({ day: String(day), users: Number(users), events: Number(events) })),
            screens: screenRows.filter(([screen]) => screen != null).map(([screen, views]) => ({ screen: String(screen), views: Number(views) })),
        };
    } catch (e) {
        console.warn('[adminAnalytics] posthog failed:', e instanceof Error ? e.message : e);
        return { ...base, status: 'error' };
    }
}

/** 최근 days일 안에 생긴 미해결 오류를 많이 난 순으로 10개 */
export async function fetchSentryReport(days, env = process.env, fetchImpl = fetch) {
    const cfg = sentryConfig(env);
    const base = { dashboardUrl: cfg.missing?.length ? null : `${cfg.host}/organizations/${cfg.org}/issues/` };
    if (cfg.missing.length) return { ...base, status: 'not_configured', missing: cfg.missing };
    const n = Number(days);
    if (!ALLOWED_DAYS.includes(n)) throw new Error('invalid days');
    try {
        const url = `${cfg.host}/api/0/projects/${cfg.org}/${cfg.project}/issues/?query=${encodeURIComponent('is:unresolved')}&statsPeriod=${n}d&sort=freq&limit=10`;
        const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${cfg.token}` } });
        if (!res.ok) throw new Error(`sentry HTTP ${res.status}`);
        const json = await res.json();
        const issues = (Array.isArray(json) ? json : []).map((i) => ({
            id: String(i.id),
            title: String(i.title ?? ''),
            culprit: i.culprit ? String(i.culprit) : null,
            level: String(i.level ?? 'error'),
            count: Number(i.count ?? 0),
            userCount: Number(i.userCount ?? 0),
            lastSeen: i.lastSeen ? String(i.lastSeen) : null,
            permalink: typeof i.permalink === 'string' && i.permalink.startsWith('https://') ? i.permalink : null,
        }));
        return { ...base, status: 'ok', issues };
    } catch (e) {
        console.warn('[adminAnalytics] sentry failed:', e instanceof Error ? e.message : e);
        return { ...base, status: 'error' };
    }
}
