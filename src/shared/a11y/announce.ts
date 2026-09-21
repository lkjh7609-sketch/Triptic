/**
 * 스크린리더 라이브 리전 알림 (VoiceOver가 화면 전환 없이 일어나는 상태
 * 변화 — 저장 완료, 오류 등 — 를 읽어주게 한다). 토스트/스낵바가 시각적
 * 피드백만 주고 끝나는 곳에서 같이 호출한다.
 */
const LIVE_REGION_ID = 'a11y-live-region';

function getOrCreateLiveRegion(): HTMLElement {
  const existing = document.getElementById(LIVE_REGION_ID);
  if (existing) return existing;

  const region = document.createElement('div');
  region.id = LIVE_REGION_ID;
  region.setAttribute('role', 'status');
  region.setAttribute('aria-live', 'polite');
  region.setAttribute('aria-atomic', 'true');
  region.style.position = 'absolute';
  region.style.left = '-10000px';
  region.style.width = '1px';
  region.style.height = '1px';
  region.style.overflow = 'hidden';
  document.body.appendChild(region);
  return region;
}

export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  const region = getOrCreateLiveRegion();
  region.setAttribute('aria-live', priority);
  region.textContent = message;
  setTimeout(() => {
    region.textContent = '';
  }, 1000);
}
