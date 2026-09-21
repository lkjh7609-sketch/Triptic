import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/shared/ui/global.css';
import '@/shared/i18n';
import { initMonitoring } from '@/shared/monitoring';
import { applyStoredTheme } from '@/shared/theme';
import { App } from './App';

initMonitoring();
applyStoredTheme();

/**
 * PWA 설치·오프라인 열람 (DEVELOPMENT_PLAN.md §10.3). legacy는 index.html에서
 * 루트 스코프로 등록하지만, 이 앱은 /preview/ 하위에서만 서빙되므로(ADR-001)
 * 같은 /sw.js 스크립트를 /preview/ 스코프로 별도 등록한다 — 스코프가 다르면
 * 별개의 ServiceWorkerRegistration이 되지만 Cache Storage(CACHE_NAME)는 오리진
 * 단위로 공유되므로 문제없다.
 */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/preview/' }).catch(() => {});
  });
}

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('#root 엘리먼트를 찾을 수 없습니다.');
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
