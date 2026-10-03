import type { ReactNode } from 'react';
import { bootShellKind, capturedBootShell } from './bootShellState';

/**
 * 앱 대기 화면(최상위 Suspense·라우터 첫 로딩·로그인 확인)에 index.html의 첫 화면 뼈대를 그대로 다시 그린다(bootShellState.ts).
 * 마크업은 우리 index.html에 고정된 것(사용자 입력 없음)이라 innerHTML로 넣어도 된다. 스타일도 index.html에 있다.
 * id가 같아서 index.html 부팅 안전망은 이 화면도 '아직 안 뜬 것'으로 본다(여기서 멈추면 새로고침·안내).
 * 저장된 뼈대가 없으면(시험 환경 등) fallback을 그린다.
 */
export function BootShell({ fallback = null }: { fallback?: ReactNode }) {
  const html = capturedBootShell();
  if (!html) return <>{fallback}</>;
  return (
    <div
      id="boot-shell"
      aria-hidden="true"
      data-boot={bootShellKind(window.location.pathname)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
