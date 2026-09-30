/**
 * "마지막으로 잘 받은 값" — 여행사·날씨 같은 외부 API에서 받아 화면에 보여주는 데이터의 공통 안전망.
 *
 * 받기에 실패하거나 빈 값이 와도 화면에서 구역이 사라지지 않게, 잘 받은 값을 이 기기(localStorage)에 남겨 두고
 * 3일까지는 그 값을 그대로 보여준다(3일이 지나면 너무 오래됐으니 버린다).
 *  - 잘 받으면: 값을 저장(시각과 함께)하고 그 값을 쓴다.
 *  - 실패하거나 빈 값이면: **오류를 던져** react-query가 이전 data를 그대로 들고 있게 한다(빈 값으로 덮지 않는다).
 *  - 캐시가 없는 첫 화면(앱을 다시 켠 직후 등)에는 저장된 값으로 시작한다(`lastGoodOptions`의 initialData).
 *
 * 사용: queryFn은 `fetchKeepingLastGood(key, fetcher, opts)`로 감싸고, useQuery에 `...lastGoodOptions(key)`를 펼친다.
 * 새로 붙이는 외부 API 데이터(특가·상품 카드·날씨 등)는 모두 이 방식으로 붙인다.
 */

/** 저장한 값을 쓸 수 있는 기간 — 3일 */
export const LAST_GOOD_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

const PREFIX = 'triptic-last-good:';

interface Stored<T> {
  savedAt: number;
  value: T;
}

/** 저장된 값(3일 안쪽인 것만). 없거나 깨졌거나 오래됐으면 undefined */
export function readLastGood<T>(key: string, now = Date.now()): T | undefined {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return undefined;
    const stored = JSON.parse(raw) as Partial<Stored<T>>;
    if (typeof stored.savedAt !== 'number' || stored.value === undefined) return undefined;
    if (now - stored.savedAt > LAST_GOOD_MAX_AGE_MS || stored.savedAt > now + 60_000) {
      localStorage.removeItem(PREFIX + key);
      return undefined;
    }
    return stored.value;
  } catch {
    return undefined;
  }
}

export function writeLastGood<T>(key: string, value: T, now = Date.now()): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ savedAt: now, value } satisfies Stored<T>));
  } catch {
    // 저장이 막힌 환경(사생활 보호 모드·용량 초과) — 없어도 화면은 동작한다
  }
}

interface KeepOptions<T> {
  /** 받은 값이 "비었다"고 볼 조건(예: 목록이 0개). 이전 값이 있으면 빈 값으로 덮지 않고 이전 값을 지킨다 */
  isEmpty?: (fresh: T) => boolean;
  /** 새 값과 이전 값을 합치는 방법(예: 도시별 기온에서 이번에 빠진 도시는 이전 값 유지). 없으면 새 값 그대로 */
  merge?: (previous: T | undefined, fresh: T) => T;
}

/**
 * fetcher로 받은 값을 돌려주고 저장한다. 실패(fetcher가 던짐)는 그대로 던지고, 빈 값은 이전 값이 있을 때만 오류로 친다.
 * 오류를 던지면 react-query는 이전 data를 지우지 않고 그대로 보여준다.
 */
export async function fetchKeepingLastGood<T>(key: string, fetcher: () => Promise<T>, { isEmpty, merge }: KeepOptions<T> = {}): Promise<T> {
  const fresh = await fetcher();
  const previous = readLastGood<T>(key);
  if (isEmpty?.(fresh)) {
    if (previous !== undefined) throw new Error(`empty result for ${key} — keeping the last good value`);
    return fresh;
  }
  const value = merge ? merge(previous, fresh) : fresh;
  writeLastGood(key, value);
  return value;
}

/** useQuery에 펼치는 옵션 — 캐시가 없을 때 저장된 값으로 시작(곧바로 새로 받되, 그 요청이 실패해도 이 값은 남는다) */
export function lastGoodOptions<T>(key: string): { initialData: () => T | undefined; initialDataUpdatedAt: number } {
  return { initialData: () => readLastGood<T>(key), initialDataUpdatedAt: 0 };
}
