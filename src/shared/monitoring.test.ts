import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const posthog = { init: vi.fn(), capture: vi.fn(), identify: vi.fn(), reset: vi.fn() };
vi.mock('posthog-js', () => ({ default: posthog }));
const sentry = { init: vi.fn(), captureException: vi.fn(), setUser: vi.fn() };
vi.mock('@sentry/react', () => sentry);

describe('monitoring', () => {
  beforeEach(() => {
    vi.resetModules();
    Object.values(posthog).forEach((fn) => fn.mockClear());
    Object.values(sentry).forEach((fn) => fn.mockClear());
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('View Transition이 가려진 문서에서 건너뛰어진 오류는 Sentry에서 무시한다(브라우저별 두 문구)', async () => {
    const m = await import('./monitoring');
    const ignored = (message: string) => m.IGNORED_ERRORS.some((re) => re.test(message));
    expect(ignored('Skipping view transition because document visibility state has become hidden.')).toBe(true);
    expect(ignored('View transition was skipped because document visibility state is hidden.')).toBe(true);
    expect(ignored('InvalidStateError: Transition was aborted because of invalid state. Document hidden')).toBe(true);
    expect(ignored("undefined is not an object (evaluating 'window.webkit.messageHandlers')")).toBe(true);
    // 다른 오류는 그대로 보낸다
    expect(ignored('InvalidStateError: something else')).toBe(false);
    expect(ignored('Failed to fetch dynamically imported module')).toBe(false);
  });

  it('분석 키가 없으면 이벤트를 조용히 버린다', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', '');
    const m = await import('./monitoring');
    expect(() => m.track('trip_created', { source: 'create_modal' })).not.toThrow();
    await m.initMonitoring();
    expect(() => m.track('place_added')).not.toThrow();
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it('준비되기 전 이벤트는 모았다가, 사용자 연결 → 이벤트 순서로 내보낸다', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test');
    const m = await import('./monitoring');
    m.track('guest_trip_started');
    m.identifyUser('user-1');
    await m.initMonitoring();
    expect(posthog.identify).toHaveBeenCalledWith('user-1');
    expect(posthog.capture).toHaveBeenCalledWith('guest_trip_started', undefined);
    expect(posthog.identify.mock.invocationCallOrder[0]).toBeLessThan(posthog.capture.mock.invocationCallOrder[0]);
    m.track('trip_created', { source: 'guest_import' });
    expect(posthog.capture).toHaveBeenLastCalledWith('trip_created', { source: 'guest_import' });
  });

  it('로그아웃하면 분석 신원을 끊는다', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test');
    const m = await import('./monitoring');
    await m.initMonitoring();
    m.identifyUser('user-1');
    m.resetIdentity();
    expect(posthog.reset).toHaveBeenCalled();
  });

  it('SDK가 준비되기 전에 난 오류는 모았다가, 오류가 나면 SDK를 바로 받아 내보낸다', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://x@sentry.test/1');
    const m = await import('./monitoring');
    const err = new Error('boom');
    m.captureError(err, { where: 'test' });
    await m.initMonitoring();
    expect(sentry.init).toHaveBeenCalledTimes(1);
    expect(sentry.captureException).toHaveBeenCalledWith(err, { extra: { where: 'test' } });
    // 준비된 뒤에는 곧바로 보낸다
    const err2 = new Error('later');
    m.captureError(err2);
    expect(sentry.captureException).toHaveBeenLastCalledWith(err2, { extra: undefined });
  });

  it('initMonitoring을 여러 번 불러도 SDK는 한 번만 초기화한다', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://x@sentry.test/1');
    const m = await import('./monitoring');
    await Promise.all([m.initMonitoring(), m.initMonitoring()]);
    expect(sentry.init).toHaveBeenCalledTimes(1);
  });

  it('scheduleMonitoring은 load와 한가한 때가 올 때까지 SDK를 받지 않는다', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://x@sentry.test/1');
    vi.useFakeTimers();
    try {
      vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
      const m = await import('./monitoring');
      m.scheduleMonitoring();
      await vi.advanceTimersByTimeAsync(10000);
      expect(sentry.init).not.toHaveBeenCalled();
      window.dispatchEvent(new Event('load'));
      await vi.advanceTimersByTimeAsync(10000);
      expect(sentry.init).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
      vi.restoreAllMocks();
    }
  });
});
