/**
 * 액티비티 탭 검색·추천을 어느 제휴사로 할지. 처음엔 한국어는 마이리얼트립(한국어 상품만 주는 곳),
 * 그 외 언어는 Klook. 직접 고른 값은 이 기기에 저장해 그대로 쓴다. 새 제휴사는 여기에 추가한다
 */
export const ACTIVITY_PROVIDERS = ['klook', 'myrealtrip'] as const;
export type ActivityProvider = (typeof ACTIVITY_PROVIDERS)[number];

const STORAGE_KEY = 'triptic.activitiesProvider';

export function defaultActivityProvider(locale: string): ActivityProvider {
  return locale.toLowerCase().startsWith('ko') ? 'myrealtrip' : 'klook';
}

export function readActivityProvider(locale: string): ActivityProvider {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return (ACTIVITY_PROVIDERS as readonly string[]).includes(saved ?? '') ? (saved as ActivityProvider) : defaultActivityProvider(locale);
  } catch {
    return defaultActivityProvider(locale);
  }
}

export function saveActivityProvider(provider: ActivityProvider): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, provider);
  } catch {
    // 저장 못 해도(사생활 보호 모드 등) 이번 화면에서는 그대로 쓴다
  }
}
