import { captureError } from '@/shared/monitoring';

const KEY = 'triptic-boot-fail';

/**
 * index.html의 부팅 안전망이 "앱이 안 떠서 새로고침했다"고 남긴 기록을 읽어 모니터링으로 보내고 지운다.
 * 사용자는 흰 화면을 겪고 새로고침으로 넘어가 버려서, 이렇게 안 남기면 원인을 알 길이 없다. 모니터링 SDK는 늦게 올라오므로 잠깐 뒤에 보낸다.
 * 값에는 오류 문구·스크립트 주소·브라우저 종류·시각만 있다(개인정보 없음).
 */
export function reportBootFailure(delayMs = 4000): void {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
    if (raw) localStorage.removeItem(KEY);
  } catch {
    return;
  }
  if (!raw) return;
  let info: unknown = { raw: raw.slice(0, 500) };
  try {
    info = JSON.parse(raw);
  } catch {
    // 깨진 기록도 그대로 보낸다
  }
  window.setTimeout(
    () => captureError(new Error('boot failure recovered'), { boot: info }),
    delayMs,
  );
}
