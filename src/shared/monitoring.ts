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

/**
 * 성장·전환 분석 이벤트 — 가입 → 첫 여행 → 첫 장소 → 서류 → 공유 중 어디서 멈추는지 보는 용도.
 * 값에는 개인정보(이름·이메일·여행 제목·장소 이름·주소)를 절대 넣지 않는다. 분류값·횟수만.
 */
export type AnalyticsEvent =
  | 'signup_completed' // { provider }
  | 'trip_created' // { source: create_modal | guest_import }
  | 'place_added' // { source }
  | 'document_uploaded'
  | 'share_link_created'
  | 'share_joined'
  | 'trip_limit_reached'
  | 'onboarding_step_done' // { step: place | document | invite }
  | 'guest_trip_started'
  | 'guest_trip_saved'; // 게스트 여행을 로그인 후 계정으로 옮김

/** 분석 SDK는 동적 import라 준비되기 전에 발생한 이벤트는 여기 모았다가 내보낸다(키가 없으면 버린다) */
type Queued = { name: string; props?: Record<string, unknown> };
let queue: Queued[] | null = [];
const QUEUE_MAX = 50;

/** 분석 SDK가 준비되기 전에 알게 된 로그인 사용자 — 준비되면 이벤트를 내보내기 전에 먼저 연결한다 */
let currentUserId: string | null = null;

function flushQueue() {
  if (currentUserId) {
    posthogModule?.identify(currentUserId);
    sentryModule?.setUser({ id: currentUserId });
  }
  const pending = queue ?? [];
  queue = null;
  for (const item of pending) posthogModule?.capture(item.name, item.props);
}

/**
 * 고칠 수 없고 해롭지 않은 오류 — Sentry로 보내지 않는다.
 * View Transition: 화면 전환 애니메이션을 시작하려는데 그 사이 앱이 백그라운드로 가면 브라우저가 전환만 건너뛰고
 * "InvalidStateError"를 던진다(문구는 브라우저마다 다름: "Skipping view transition because document visibility state has become hidden." /
 * "View transition was skipped because document visibility state is hidden." / Chrome 154: "Transition was aborted because of
 * invalid state. Document hidden"). 화면 이동 자체는 정상으로 끝난다.
 * 앱 내 브라우저(iOS WKWebView): 앱이 페이지에 끼워 넣은 스크립트가 window.webkit.messageHandlers를 찾다가 실패한다.
 * 우리 코드엔 이 이름이 없고, 스택이 "triptic.my/:1"(실제 index.html은 여러 줄)이라 주입 스크립트다(2026-10-06).
 */
export const IGNORED_ERRORS: RegExp[] = [/view transition.*visibility state/i, /transition was aborted because of invalid state/i, /webkit\.messageHandlers/i];

let initPromise: Promise<void> | null = null;

/** 두 번 불려도 한 번만 받는다 — 오류가 먼저 터져 앞당겨 부르는 경우와 예약된 호출이 겹칠 수 있다 */
export function initMonitoring(): Promise<void> {
  initPromise ??= loadMonitoring();
  return initPromise;
}

async function loadMonitoring(): Promise<void> {
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
  if (sentryDsn && !sentryModule) {
    const Sentry = await import('@sentry/react');
    Sentry.init({
      dsn: sentryDsn,
      release: `triptic@${import.meta.env.VITE_APP_VERSION ?? 'dev'}`,
      environment: import.meta.env.MODE,
      tracesSampleRate: import.meta.env.PROD ? 0.2 : 0,
      // 광고(애드센스) 스크립트 안에서 나는 오류는 우리 코드가 아니라 고칠 수 없다 — 예: iOS Safari에서
      // pagead2.googlesyndication.com의 rum_fy2021.js가 던지는 "Error: int64"(2026-09-30). 스택 맨 위가 이 주소면 버린다.
      ignoreErrors: IGNORED_ERRORS,
      denyUrls: [/googlesyndication\.com/i, /doubleclick\.net/i, /googletagservices\.com/i, /adservice\.google\./i],
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
      // 화면 글자·입력이 새어 나가지 않게: 클릭 자동 수집과 화면 녹화는 끄고, 위에서 정한 이벤트만 보낸다
      autocapture: false,
      disable_session_recording: true,
      // 설문 기능은 안 쓴다 — 켜 두면 초기화 직후 surveys.js(33KB)를 따로 받는다(Lighthouse 2026-10-04)
      disable_surveys: true,
      // 쿠키 대신 브라우저 저장소(localStorage)만 쓴다
      persistence: 'localStorage',
      // 브라우저의 "추적 안 함" 설정을 켠 사용자는 이용 분석 이벤트를 보내지 않는다(방침 1번에 안내)
      respect_dnt: true,
    });
    posthogModule = posthog;
  }
  flushQueue();
  flushErrors();
}

function capture(name: string, props?: Record<string, unknown>): void {
  if (posthogModule) {
    posthogModule.capture(name, props);
  } else if (queue && queue.length < QUEUE_MAX) {
    queue.push({ name, props });
  }
}

/** 화면 진입 시 1건 (02-screens.md §1.3: 화면명만, 개인정보 금지) */
export function trackScreenView(screenName: string): void {
  capture('screen_view', { screen: screenName });
}

/** 성장·전환 이벤트 1건. 분석 키가 없으면 아무 일도 하지 않는다 */
export function track(event: AnalyticsEvent, props?: Record<string, string | number | boolean>): void {
  capture(event, props);
}

/** 로그인한 사용자를 무작위 아이디(UUID)로만 구분한다 — 이름·이메일은 보내지 않는다 */
export function identifyUser(userId: string): void {
  currentUserId = userId;
  posthogModule?.identify(userId);
  sentryModule?.setUser({ id: userId });
}

/** 로그아웃 — 다음 사람과 섞이지 않게 분석 신원을 끊는다 */
export function resetIdentity(): void {
  currentUserId = null;
  posthogModule?.reset();
  sentryModule?.setUser(null);
}

/** Sentry가 준비되기 전에 난 오류 — 준비되면 내보낸다 */
let errorQueue: { error: unknown; context?: Record<string, unknown> }[] = [];
const ERROR_QUEUE_MAX = 20;

function flushErrors() {
  const pending = errorQueue;
  errorQueue = [];
  for (const item of pending) sentryModule?.captureException(item.error, { extra: item.context });
}

export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (sentryModule) {
    sentryModule.captureException(error, { extra: context });
  } else {
    if (import.meta.env.DEV) console.error('[monitoring:dev-only]', error, context);
    // 첫 화면이 그려질 때까지 SDK 내려받기를 미루는 동안(scheduleMonitoring) 난 오류는 모아 두고, 오류가 났으니 SDK를 바로 받아 내보낸다
    // (DSN이 없으면 initMonitoring이 아무것도 안 받고 끝나 모은 것은 flushErrors에서 버려진다)
    if (errorQueue.length < ERROR_QUEUE_MAX) errorQueue.push({ error, context });
    void initMonitoring();
  }
}

/**
 * 부팅 때 바로 SDK(Sentry ~150KB + PostHog ~100KB)를 받으면 첫 화면 그리기와 같은 회선·메인 스레드를 다툰다(Lighthouse 측정 2026-10-04).
 * 그래서 페이지 load가 끝나고 브라우저가 한가할 때 받는다(최대 5초 안). 그 전에 난 처리 안 된 오류는 captureError로 모았다가
 * SDK가 준비되면 내보낸다(오류가 나면 기다리지 않고 바로 받는다).
 */
export function scheduleMonitoring(): void {
  if (initPromise) return;
  const onError = (e: ErrorEvent) => captureError(e.error ?? e.message);
  const onRejection = (e: PromiseRejectionEvent) => captureError(e.reason);
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  const start = () => {
    // 이 시점부터는 Sentry가 자기 전역 핸들러를 달기 때문에 우리 것은 뗀다(중복 보고 방지)
    void initMonitoring().finally(() => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    });
  };
  const idle = () => {
    if ('requestIdleCallback' in window) window.requestIdleCallback(start, { timeout: 5000 });
    else setTimeout(start, 2000);
  };
  if (document.readyState === 'complete') idle();
  else window.addEventListener('load', idle, { once: true });
}
