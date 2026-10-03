/** 알림의 읽음·지우기 기록 — 이 기기 브라우저(localStorage)에만 사용자별로 저장한다. 다른 기기에선 다시 새 알림으로 보인다 */

interface NotificationState {
  read: string[];
  dismissed: string[];
}

const KEY_PREFIX = 'triptic-notifications:';
const MAX_KEEP = 100;
const EMPTY: NotificationState = { read: [], dismissed: [] };

type Listener = () => void;
const listeners = new Set<Listener>();
// useSyncExternalStore가 같은 값에는 같은 참조를 받아야 해서 읽은 결과를 저장 문자열별로 둔다
const cache = new Map<string, { raw: string | null; state: NotificationState }>();

function key(userId: string): string {
  return KEY_PREFIX + userId;
}

function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

export function readNotificationState(userId: string): NotificationState {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key(userId));
  } catch {
    // 저장소를 못 읽으면(사생활 보호 모드 등) 빈 기록으로 본다
  }
  const hit = cache.get(userId);
  if (hit && hit.raw === raw) return hit.state;
  let state = EMPTY;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<NotificationState>;
      state = { read: strings(parsed.read), dismissed: strings(parsed.dismissed) };
    } catch {
      state = EMPTY;
    }
  }
  cache.set(userId, { raw, state });
  return state;
}

function write(userId: string, state: NotificationState) {
  const next = { read: state.read.slice(-MAX_KEEP), dismissed: state.dismissed.slice(-MAX_KEEP) };
  try {
    localStorage.setItem(key(userId), JSON.stringify(next));
  } catch {
    // 저장 못 해도 이번 접속에서는 아래 알림으로 계속 동작한다
    cache.set(userId, { raw: null, state: next });
  }
  listeners.forEach((l) => l());
}

export function markNotificationsRead(userId: string, ids: string[]) {
  const cur = readNotificationState(userId);
  const add = ids.filter((id) => !cur.read.includes(id));
  if (add.length === 0) return;
  write(userId, { ...cur, read: [...cur.read, ...add] });
}

export function dismissNotification(userId: string, id: string) {
  const cur = readNotificationState(userId);
  if (cur.dismissed.includes(id)) return;
  write(userId, {
    read: cur.read.includes(id) ? cur.read : [...cur.read, id],
    dismissed: [...cur.dismissed, id],
  });
}

export function subscribeNotifications(listener: Listener): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key?.startsWith(KEY_PREFIX)) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}
