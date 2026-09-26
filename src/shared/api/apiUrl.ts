import { isNativeApp } from '@/shared/platform';

/** 네이티브 앱(capacitor://localhost)에서 서버리스 함수를 부를 때 쓰는 운영 도메인 */
const PRODUCTION_ORIGIN = 'https://triptic.my';

/**
 * `/api/*` 서버리스 함수의 절대/상대 URL을 만든다.
 * - 웹(운영·프리뷰): 같은 오리진 상대 경로
 * - 로컬 개발: 상대 경로 → vite.config.js의 dev 어댑터가 api/*.js를 직접 실행
 * - 네이티브 앱: 정적 파일만 번들돼 있어 상대 경로가 존재하지 않으므로 운영 도메인
 * `VITE_API_BASE_URL`이 있으면 무엇보다 우선한다(스테이징 등).
 */
export function apiUrl(path: string): string {
  const override = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (override) return `${override.replace(/\/$/, '')}${path}`;
  return isNativeApp() ? `${PRODUCTION_ORIGIN}${path}` : path;
}
