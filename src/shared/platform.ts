/**
 * Capacitor 네이티브 셸(iOS/Android 앱) 안에서 실행 중인지 판별한다.
 * ⚠️ `window.Capacitor`가 있는지만 보면 안 된다 — @capacitor/core를 번들에 넣으면 웹 브라우저에서도 그 전역이 만들어진다
 * (2026-10-08 푸시 코드를 메인 번들에 넣었다가 웹이 앱으로 판별돼 호텔 탭·소셜 로그인이 앱 방식으로 바뀌었다).
 * 그래서 Capacitor가 알려 주는 '네이티브 플랫폼인가'(isNativePlatform)를 쓰고, 앱 전용 주소(capacitor:)도 본다.
 */
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.location.protocol === 'capacitor:') return true;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return typeof cap?.isNativePlatform === 'function' && cap.isNativePlatform() === true;
}
