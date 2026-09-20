/**
 * 게스트(비로그인 공유 뷰어) 이름 저장 (index.html getGuestName/saveGuestName 이식)
 * 원본: index.html 2026-09-20 기준 라인 4007~4013.
 */
const STORAGE_KEY = 'tripticGuestName';

export function getGuestName(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveGuestName(name: string): void {
  const v = (name || '').trim();
  if (!v) return;
  try {
    localStorage.setItem(STORAGE_KEY, v);
  } catch {
    // 비공개 브라우징 등으로 저장이 막혀 있어도 제안 자체는 계속 진행할 수 있어야 한다
  }
}
