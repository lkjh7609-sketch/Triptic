import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { closeLoginPrompt, requireLogin, setSignedIn, useLoginPromptOpen } from './loginPrompt';

afterEach(() => {
  act(() => {
    setSignedIn(false);
    closeLoginPrompt();
  });
});

describe('requireLogin — 로그인 필요 동작', () => {
  it('로그인했으면 그대로 통과(이동을 막지 않고 창도 안 연다)', () => {
    setSignedIn(true);
    const { result } = renderHook(() => useLoginPromptOpen());
    const preventDefault = vi.fn();
    expect(requireLogin({ preventDefault })).toBe(true);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(result.current).toBe(false);
  });

  it('비로그인이면 이동을 막고 로그인 창을 연다 — 로그인하면 닫힌다', () => {
    const { result } = renderHook(() => useLoginPromptOpen());
    const preventDefault = vi.fn();
    let passed = true;
    act(() => {
      passed = requireLogin({ preventDefault });
    });
    expect(passed).toBe(false);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(result.current).toBe(true);

    act(() => setSignedIn(true));
    expect(result.current).toBe(false);
  });
});
