import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/shared/ui/global.css';
import '@/shared/i18n';
import { initMonitoring } from '@/shared/monitoring';
import { applyStoredTheme } from '@/shared/theme';
import { App } from './App';

initMonitoring();
applyStoredTheme();

/** PWA 설치·오프라인 열람 (DEVELOPMENT_PLAN.md §10.3). */
if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  });
}

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('#root element not found');
}

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
