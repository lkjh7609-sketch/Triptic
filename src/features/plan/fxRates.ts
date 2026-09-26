/**
 * 환율 (02-screens.md §3.7 "환율 자동 변환").
 *
 * 흐름: supabase/functions/fx-refresh가 매시 5분(pg_cron) 실제 환율 API(Coinbase,
 * 실패 시 open.er-api.com)에서 지원 통화 전체를 한 번에 받아 fx_rates 테이블에
 * 저장한다. 실패한 통화는 갱신하지 않으므로 직전 값이 그대로 남는다.
 * 클라이언트는 이 테이블만 읽고(외부 API를 직접 부르지 않음) 1시간 동안 같은 값을
 * 재사용한다. TanStack Query 영속 캐시(IndexedDB)에 함께 저장돼 오프라인에서도
 * 마지막 값으로 환산할 수 있다.
 */
import { getSupabaseClient } from '@/shared/api/supabaseClient';

export interface FxRates {
  /** 통화 코드 → 1 USD당 해당 통화 금액 */
  perUsd: Record<string, number>;
  /** 가장 최근 갱신 시각(ISO) — 표시용 */
  newestAt: string | null;
}

export const ONE_HOUR_MS = 60 * 60 * 1000;
/** 크론이 멈춰 이보다 오래되면 클라이언트가 갱신을 한 번 요청한다(함수가 자체적으로 중복 호출을 막는다) */
const STALE_TRIGGER_MS = 2 * ONE_HOUR_MS;

export const fxRatesQueryKey = ['fx-rates'] as const;

export async function fetchFxRates(): Promise<FxRates> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('fx_rates').select('currency, rate_per_usd, fetched_at');
  if (error) throw error;

  const perUsd: Record<string, number> = { USD: 1 };
  let newestAt: string | null = null;
  for (const row of data ?? []) {
    const rate = Number(row.rate_per_usd);
    if (Number.isFinite(rate) && rate > 0) perUsd[row.currency] = rate;
    if (!newestAt || row.fetched_at > newestAt) newestAt = row.fetched_at;
  }

  if (!newestAt || Date.now() - new Date(newestAt).getTime() > STALE_TRIGGER_MS) {
    void supabase.functions.invoke('fx-refresh', { body: {} }).catch(() => {});
  }
  return { perUsd, newestAt };
}

/** `from` 1단위 = 반환값 × `to`. 둘 중 하나라도 환율이 없으면 null */
export function getRate(rates: FxRates | undefined, from: string, to: string): number | null {
  if (from === to) return 1;
  const fromPerUsd = rates?.perUsd[from];
  const toPerUsd = rates?.perUsd[to];
  if (!fromPerUsd || !toPerUsd) return null;
  return toPerUsd / fromPerUsd;
}
