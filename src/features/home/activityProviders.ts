/** 액티비티 탭 검색·추천을 어느 제휴사로 할지 — 기본은 Klook. 새 제휴사는 여기에 추가한다 */
export const ACTIVITY_PROVIDERS = ['klook', 'myrealtrip'] as const;
export type ActivityProvider = (typeof ACTIVITY_PROVIDERS)[number];

const STORAGE_KEY = 'triptic.activitiesProvider';

export function readActivityProvider(): ActivityProvider {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return (ACTIVITY_PROVIDERS as readonly string[]).includes(saved ?? '') ? (saved as ActivityProvider) : 'klook';
  } catch {
    return 'klook';
  }
}

export function saveActivityProvider(provider: ActivityProvider): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, provider);
  } catch {
    // 저장 못 해도(사생활 보호 모드 등) 이번 화면에서는 그대로 쓴다
  }
}
