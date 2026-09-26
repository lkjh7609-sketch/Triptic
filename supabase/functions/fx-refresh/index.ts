/**
 * Supabase Edge Function: fx-refresh — 지원 통화 전체 환율을 한 번에 받아 fx_rates에 저장
 *
 * 호출: pg_cron이 매시 5분(0031 마이그레이션). 클라이언트도 캐시가 2시간 넘게 오래되면
 * 한 번 호출한다(src/features/plan/fxRates.ts) — 55분 안에 이미 갱신됐으면 아무것도
 * 하지 않으므로 여러 번 불려도 외부 API는 시간당 한 번만 나간다.
 *
 * 규칙(사용자 요구사항):
 * - 1순위 Coinbase 공개 환율(키 불필요), 실패하면 백오프로 최대 3회 재시도
 * - 그래도 빠진 통화는 2순위 open.er-api.com으로 최대 2회 재시도
 * - 끝까지 실패한 통화는 갱신하지 않는다 → 직전(한 시간 전) 값이 그대로 남아 계속 쓰인다
 * - 성공한 통화는 새 값으로 덮어쓴다(이전 값 폐기)
 */
import { createClient } from '@supabase/supabase-js';
import { SUPPORTED_CURRENCIES } from '../../../src/features/plan/currencies.ts';

const MIN_REFRESH_INTERVAL_MS = 55 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;

type RateMap = Record<string, number>;

function corsHeaders(origin: string | null) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
  }
  headers.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  return headers;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** 지원 통화만 골라 1 USD당 금액(양수 유한값)으로 정리 */
function pickRates(raw: Record<string, unknown> | undefined, wanted: readonly string[]): RateMap {
  const out: RateMap = {};
  if (!raw) return out;
  for (const code of wanted) {
    const value = Number(raw[code]);
    if (Number.isFinite(value) && value > 0) out[code] = value;
  }
  return out;
}

async function withRetry(label: string, attempts: number, fn: () => Promise<RateMap>): Promise<RateMap> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const rates = await fn();
      if (Object.keys(rates).length > 0) return rates;
      lastError = new Error('empty rates');
    } catch (err) {
      lastError = err;
    }
    if (i < attempts - 1) await sleep(1000 * 2 ** i);
  }
  console.warn(`[fx-refresh] ${label} failed:`, lastError instanceof Error ? lastError.message : lastError);
  return {};
}

const fromCoinbase = (wanted: readonly string[]) =>
  withRetry('coinbase', 3, async () => {
    const json = (await fetchJson('https://api.coinbase.com/v2/exchange-rates?currency=USD')) as {
      data?: { rates?: Record<string, unknown> };
    };
    return pickRates(json.data?.rates, wanted);
  });

const fromErApi = (wanted: readonly string[]) =>
  withRetry('open.er-api', 2, async () => {
    const json = (await fetchJson('https://open.er-api.com/v6/latest/USD')) as {
      result?: string;
      rates?: Record<string, unknown>;
    };
    if (json.result !== 'success') throw new Error(`result=${json.result}`);
    return pickRates(json.rates, wanted);
  });

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const { data: latest } = await admin
    .from('fx_rates')
    .select('fetched_at')
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latest && Date.now() - new Date(latest.fetched_at).getTime() < MIN_REFRESH_INTERVAL_MS) {
    return new Response(JSON.stringify({ skipped: true, lastFetchedAt: latest.fetched_at }), { status: 200, headers });
  }

  const wanted = SUPPORTED_CURRENCIES.filter((c) => c !== 'USD');
  const primary = await fromCoinbase(wanted);
  const missing = wanted.filter((c) => !(c in primary));
  const secondary = missing.length > 0 ? await fromErApi(missing) : {};

  const now = new Date().toISOString();
  const rows = [
    { currency: 'USD', rate_per_usd: 1, source: 'fixed', fetched_at: now },
    ...Object.entries(primary).map(([currency, rate]) => ({ currency, rate_per_usd: rate, source: 'coinbase', fetched_at: now })),
    ...Object.entries(secondary).map(([currency, rate]) => ({ currency, rate_per_usd: rate, source: 'open.er-api', fetched_at: now })),
  ];
  const failed = missing.filter((c) => !(c in secondary));

  if (rows.length === 1) {
    // 모든 소스 실패 — 아무것도 덮어쓰지 않는다(USD 행도 갱신하지 않아야 다음 호출이 스킵되지 않는다)
    return new Response(JSON.stringify({ updated: [], failed: wanted }), { status: 502, headers });
  }

  const { error } = await admin.from('fx_rates').upsert(rows, { onConflict: 'currency' });
  if (error) {
    console.error('[fx-refresh] upsert failed:', error.message);
    return new Response(JSON.stringify({ error: 'db_write_failed' }), { status: 500, headers });
  }

  return new Response(
    JSON.stringify({ updated: rows.map((r) => r.currency), failed, fetchedAt: now }),
    { status: 200, headers },
  );
});
