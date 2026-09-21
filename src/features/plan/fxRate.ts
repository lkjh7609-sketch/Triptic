/**
 * 환율 자동 변환 (02-screens.md §3.7 "환율 자동 변환 — 일별 환율 스냅샷 저장")
 * Frankfurter(https://frankfurter.dev, ECB 매일 공시 환율 기반 무료·키 불필요
 * 공개 API)를 그대로 사용한다. 여행 기본 통화(KRW/JPY/USD/EUR, expenses.ts
 * CURRENCIES)는 전부 ECB 공시 대상이라 커버리지 문제 없음.
 *
 * "일별 스냅샷"이라는 스펙 표현에 맞춰, 하루에 같은 통화쌍을 여러 번 조회해도
 * 네트워크 호출은 한 번만 나가도록 sessionStorage에 날짜 단위로 캐시한다.
 */

const FX_API_BASE = 'https://api.frankfurter.dev/v1';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function cacheKey(from: string, to: string): string {
  return `triptic-fx-${todayKey()}-${from}-${to}`;
}

function readCache(key: string): number | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, rate: number): void {
  try {
    sessionStorage.setItem(key, String(rate));
  } catch {
    // 프라이빗 브라우징 등으로 접근 불가한 경우 캐시 없이 계속 진행
  }
}

/**
 * `from` 통화 1단위 = 반환값 × `to` 통화. 조회 실패 시 null(호출부는 환율
 * 미확정 상태로 저장하고 사용자에게 알려야 한다 — 조용히 1:1로 넘기지 않는다).
 */
export async function fetchDailyRate(from: string, to: string): Promise<number | null> {
  if (from === to) return 1;

  const key = cacheKey(from, to);
  const cached = readCache(key);
  if (cached != null) return cached;

  try {
    const res = await fetch(`${FX_API_BASE}/latest?base=${encodeURIComponent(from)}&symbols=${encodeURIComponent(to)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { rates?: Record<string, number> };
    const rate = data.rates?.[to];
    if (typeof rate !== 'number' || !Number.isFinite(rate)) return null;
    writeCache(key, rate);
    return rate;
  } catch {
    return null;
  }
}
