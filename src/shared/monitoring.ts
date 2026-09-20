/**
 * Sentry + PostHog 연동 (DEVELOPMENT_PLAN.md §9 Phase 0)
 * Apple 키와 동일한 취급: 계정을 아직 만들지 않았으므로 DSN/키를 비워 두고,
 * 값이 없으면 조용히 no-op한다. 값이 채워지는 순간 그대로 동작한다.
 *
 * 두 SDK 모두 동적 import로 불러온다 — 키가 비어 있는 지금은 아예 내려받지
 * 않아, 초기 번들 예산(DEVELOPMENT_PLAN.md §10.1: 초기 로드 JS ≤ 250KB gzip)을
 * 정적 import로 잠식하지 않는다.
 */
import type * as SentryNS from '@sentry/react';

let sentryModule: typeof SentryNS | null = null;
let posthogModule: typeof import('posthog-js').default | null = null;

export async function initMonitoring(): Promise<void> {
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
  if (sentryDsn && !sentryModule) {
    const Sentry = await import('@sentry/react');
    Sentry.init({
      dsn: sentryDsn,
      release: `triptic@${import.meta.env.VITE_APP_VERSION ?? 'dev'}`,
      environment: import.meta.env.MODE,
      tracesSampleRate: import.meta.env.PROD ? 0.2 : 0,
    });
    sentryModule = Sentry;
  }

  const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
  if (posthogKey && !posthogModule) {
    const { default: posthog } = await import('posthog-js');
    posthog.init(posthogKey, {
      api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
      capture_pageview: false, // 화면 전환은 02-screens.md §1.3 규칙에 맞춰 직접 기록한다
      // 개인정보 최소 수집 (DEVELOPMENT_PLAN.md §5 분석: "개인정보 최소 수집")
      person_profiles: 'identified_only',
    });
    posthogModule = posthog;
  }
}

/** 화면 진입 시 1건 (02-screens.md §1.3: 화면명만, 개인정보 금지) */
export function trackScreenView(screenName: string): void {
  posthogModule?.capture('screen_view', { screen: screenName });
}

export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (sentryModule) {
    sentryModule.captureException(error, { extra: context });
  } else if (import.meta.env.DEV) {
    console.error('[monitoring:dev-only]', error, context);
  }
}
