import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reportBootFailure } from './bootFailure';

const captureError = vi.hoisted(() => vi.fn());
vi.mock('@/shared/monitoring', () => ({ captureError }));

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  captureError.mockClear();
});
afterEach(() => vi.useRealTimers());

describe('reportBootFailure', () => {
  it('남겨진 기록이 있으면 잠시 뒤 모니터링으로 보내고 지운다', () => {
    localStorage.setItem(
      'triptic-boot-fail',
      JSON.stringify({
        reasons: ['script-error /assets/x.js'],
        ua: 'iPhone',
        at: '2026-10-04T00:00:00Z',
      }),
    );
    reportBootFailure(1000);
    expect(localStorage.getItem('triptic-boot-fail')).toBeNull();
    expect(captureError).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(captureError).toHaveBeenCalledTimes(1);
    expect(captureError.mock.calls[0][1]).toEqual({
      boot: { reasons: ['script-error /assets/x.js'], ua: 'iPhone', at: '2026-10-04T00:00:00Z' },
    });
  });

  it('기록이 없으면 아무것도 보내지 않는다', () => {
    reportBootFailure(0);
    vi.runAllTimers();
    expect(captureError).not.toHaveBeenCalled();
  });
});
