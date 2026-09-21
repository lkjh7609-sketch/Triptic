/** Capacitor 네이티브 셸(iOS/Android 앱) 안에서 실행 중인지 판별한다. */
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.protocol === 'capacitor:' ||
    typeof (window as unknown as { Capacitor?: unknown }).Capacitor !== 'undefined'
  );
}
