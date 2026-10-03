import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/shared/ui/global.css';
import '@/shared/i18n';
import { initMonitoring } from '@/shared/monitoring';
import { applyStoredTheme } from '@/shared/theme';
import { isNativeApp } from '@/shared/platform';
import { App } from './App';
import { installStaleChunkReload } from './chunkRetry';
import { reportBootFailure } from './bootFailure';
import { captureBootShell } from './bootShellState';

installStaleChunkReload();
reportBootFailure();
initMonitoring();
applyStoredTheme();

/** PWA 설치·오프라인 열람 (DEVELOPMENT_PLAN.md §10.3). */
// 네이티브 앱(capacitor://)은 WKWebView가 커스텀 스킴에서 SW를 지원하지 않고, 정적
// 파일이 이미 앱에 번들돼 있어 SW가 필요 없다.
if ('serviceWorker' in navigator && !import.meta.env.DEV && !isNativeApp()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  });
}

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('#root element not found');
}
// React가 #root를 비우기 전에 첫 화면 뼈대를 저장해 대기 화면으로 다시 쓴다(BootShell)
captureBootShell();

if (import.meta.env.DEV) {
  navigator.serviceWorker?.getRegistrations().then((registrations) => {
    for (const r of registrations) {
      r.unregister();
    }
  });
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
