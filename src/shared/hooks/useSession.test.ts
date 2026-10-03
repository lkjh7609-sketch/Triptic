import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Listener = (event: string, session: { user: { id: string } } | null) => void;
let listener: Listener | null = null;
const getCurrentUser = vi.fn();
const readStoredSessionUser = vi.fn();
vi.mock('@/shared/api/authService', () => ({
  getCurrentUser: () => getCurrentUser(),
  readStoredSessionUser: () => readStoredSessionUser(),
  onAuthStateChange: (cb: Listener) => {
    listener = cb;
    return { unsubscribe: () => (listener = null) };
  },
}));

const { useSession, SESSION_WAIT_LIMIT_MS } = await import('./useSession');

beforeEach(() => {
  vi.useFakeTimers();
  getCurrentUser.mockReturnValue(new Promise(() => {})); // 갱신 요청이 멈춘 상황
  readStoredSessionUser.mockReturnValue(null);
});
afterEach(() => {
  vi.useRealTimers();
  listener = null;
});

describe('useSession', () => {
  it('저장된 로그인이 있으면 서버 확인을 기다리지 않고 그 사용자로 바로 그린다', () => {
    readStoredSessionUser.mockReturnValue({ id: 'u1' });
    const { result } = renderHook(() => useSession());
    expect(result.current).toEqual({ user: { id: 'u1' }, loading: false });
  });

  it('저장된 로그인이 없고 확인이 멈추면 정해진 시간 뒤 비로그인으로 그린다', () => {
    const { result } = renderHook(() => useSession());
    expect(result.current.loading).toBe(true);
    act(() => vi.advanceTimersByTime(SESSION_WAIT_LIMIT_MS - 1));
    expect(result.current.loading).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toEqual({ user: null, loading: false });
  });

  it('늦게 온 인증 이벤트가 화면을 맞춘다(갱신 성공 → 로그인, 실패 → 로그아웃)', () => {
    readStoredSessionUser.mockReturnValue({ id: 'u1' });
    const { result } = renderHook(() => useSession());
    act(() => vi.advanceTimersByTime(SESSION_WAIT_LIMIT_MS));
    expect(result.current.user).toEqual({ id: 'u1' });
    act(() => listener?.('SIGNED_OUT', null));
    expect(result.current).toEqual({ user: null, loading: false });
    act(() => listener?.('SIGNED_IN', { user: { id: 'u2' } }));
    expect(result.current).toEqual({ user: { id: 'u2' }, loading: false });
  });

  it('시간이 지나기 전에 확인이 끝나면 그 결과를 쓰고, 시간 제한이 덮어쓰지 않는다', () => {
    const { result } = renderHook(() => useSession());
    act(() => listener?.('INITIAL_SESSION', { user: { id: 'u3' } }));
    act(() => vi.advanceTimersByTime(SESSION_WAIT_LIMIT_MS));
    expect(result.current).toEqual({ user: { id: 'u3' }, loading: false });
  });
});
