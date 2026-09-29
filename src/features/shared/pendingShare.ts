/**
 * 공유 링크로 들어왔다가 로그인하러 나간 사이 코드를 잃지 않게 잠깐 적어 둔다.
 * 로그인은 보통 같은 주소(/shared/:code)로 돌아오지만, 소셜 로그인 리디렉트가 경로를 버리고
 * 첫 화면으로 돌아오는 경우에도 이어서 참여할 수 있게 한다(AppShell이 읽는다).
 * 로그인 안 하고 떠난 코드가 한참 뒤 로그인할 때 튀어나오지 않게 30분만 유효하다.
 */
const KEY = 'triptic-pending-share';
const TTL_MS = 30 * 60 * 1000;

export function savePendingShare(code: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ code, at: Date.now() }));
  } catch {
    // 저장소를 못 쓰면 같은 주소로 돌아오는 기본 흐름만 쓴다
  }
}

/** 남아 있는 코드를 꺼내고 지운다 — 없거나 오래됐으면 null */
export function takePendingShare(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    localStorage.removeItem(KEY);
    const { code, at } = JSON.parse(raw) as { code?: string; at?: number };
    if (!code || !at || Date.now() - at > TTL_MS) return null;
    return code;
  } catch {
    return null;
  }
}

export function clearPendingShare(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 무시
  }
}
