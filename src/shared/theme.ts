/**
 * 테마 전환 (02-screens.md §5 환경설정 "테마(시스템/라이트/다크)")
 * tokens.css는 이미 `:root[data-theme='dark']`/시스템 `prefers-color-scheme`
 * 폴백을 갖추고 있었다(01-design-system.md §2.3) — 이 모듈은 그 스위치를 실제로
 * 켜고 끄는 역할만 한다. 계정이 아니라 이 기기에만 적용되는 표시 설정이라
 * localStorage에 저장한다(프로필 동기화 대상 아님).
 */
export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'triptic-theme';

export function getStoredTheme(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // 프라이빗 모드 등으로 접근 불가 — 시스템 기본값으로 폴백
  }
  return 'system';
}

function apply(theme: ThemePreference) {
  if (theme === 'system') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

/** 앱 부팅 시(main.tsx) 저장된 선택을 즉시 반영 — 렌더 전에 호출해 깜빡임을 막는다 */
export function applyStoredTheme() {
  apply(getStoredTheme());
}

export function setTheme(theme: ThemePreference) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // 저장 실패해도 이번 세션 화면 반영은 계속 진행
  }
  apply(theme);
}
