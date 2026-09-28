import { useSyncExternalStore } from 'react';

/**
 * 비로그인 둘러보기(PC)에서 띄우는 로그인 창 — 헤더 "로그인", 계획 만들기·글쓰기처럼 로그인이
 * 필요한 동작 어디서든 연다. 창은 AppShell 한 곳에서 그린다.
 */
let open = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function openLoginPrompt() {
  if (open) return;
  open = true;
  emit();
}

export function closeLoginPrompt() {
  if (!open) return;
  open = false;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLoginPromptOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => open,
    () => false,
  );
}

/**
 * 로그인 여부 — AppShell이 세션을 확인한 뒤(자식 화면을 그리기 전에) 알려 준다. 화면마다
 * useSession()을 새로 부르면 처음엔 늘 "비로그인·불러오는 중"이라, 로그인한 사용자가 화면이
 * 뜨자마자 누른 버튼이 막힐 수 있었다.
 */
let signedIn = false;

export function setSignedIn(value: boolean) {
  signedIn = value;
  if (value) closeLoginPrompt();
}

/**
 * 로그인해야 하는 동작 앞에 건다. 로그인했으면 true, 아니면 로그인 창을 열고 false.
 * 링크의 onClick에 그대로 넘기면 비로그인일 때 이동을 막는다.
 */
export function requireLogin(e?: { preventDefault: () => void }): boolean {
  if (signedIn) return true;
  e?.preventDefault();
  openLoginPrompt();
  return false;
}

export function useRequireLogin() {
  return requireLogin;
}
