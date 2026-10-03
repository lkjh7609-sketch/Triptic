/**
 * 첫 화면 뼈대(index.html의 #boot-shell) — 앱이 뜨기 전에 보이는 로고·회색 면(글자·움직임 없음).
 *
 * React는 #root를 처음 그릴 때 안의 마크업을 지운다. 그 뒤에도 번역 파일·화면 청크·로그인 확인을 기다리는 동안
 * 대기 화면이 비어 있으면(예전 Suspense fallback={null}) 뼈대가 사라졌다가 실제 화면이 나와 다시 흰 화면이 끼었다.
 * 그래서 React가 그리기 전에 마크업을 저장해 두고, 대기 화면마다 같은 것을 다시 그린다(BootShell).
 */
let captured: string | null = null;

/** main.tsx가 createRoot 전에 한 번 부른다 */
export function captureBootShell(): void {
  captured = document.getElementById('boot-shell')?.innerHTML ?? null;
}

export function capturedBootShell(): string | null {
  return captured;
}

export type BootShellKind = 'home' | 'shell' | 'bare';

/** 주소별 뼈대 — index.html의 인라인 스크립트와 같은 규칙. 홈은 홈 모양, 4탭 화면은 머리줄·탭바만, 그 밖(전체 화면)은 배경만 */
export function bootShellKind(pathname: string): BootShellKind {
  if (pathname === '/') return 'home';
  if (/^\/(flights|hotels|activities|plan|community)\/?$/.test(pathname)) return 'shell';
  return 'bare';
}
