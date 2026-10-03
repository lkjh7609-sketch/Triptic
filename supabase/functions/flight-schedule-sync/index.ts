/**
 * Supabase Edge Function: flight-schedule-sync — 인천공항 정기편 시즌 스케줄을 받아 icn_flight_schedule에 통째로 저장
 *
 * 호출: pg_cron이 매일 04:00(KST, 0083 마이그레이션). 20시간 안에 이미 받았으면 아무것도 하지 않는다(anon 키로도 불리므로 외부 호출 남용 방지).
 * 설정(한 번만): supabase secrets set DATA_GO_KR_KEY=<data.go.kr 일반 인증키>
 *   (활용신청: '인천국제공항공사_여객편 정기 운항 스케줄 — 여행 플랫폼용' statusOfSPaxFlt4TripPlatform)
 * 출발·도착 어느 쪽이든 못 받으면 이전 표를 그대로 둔다.
 */
import { createClient } from '@supabase/supabase-js';
import { normalizeIcnSchedule, type Direction } from '../../../src/features/plan/flightLookup/schedule.ts';

const BASE = 'https://apis.data.go.kr/B551177/statusOfSPaxFlt4TripPlatform';
const OPERATION: Record<Direction, string> = {
  dep: 'getSPaxFlt4TripPlatformDepartures',
  arr: 'getSPaxFlt4TripPlatformArrivals',
};
const MIN_SYNC_INTERVAL_MS = 20 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 30000;
const PAGE_SIZE = 1000;
const MAX_PAGES = 10;

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

async function fetchAll(direction: Direction, apiKey: string): Promise<unknown[]> {
  const items: unknown[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const params = new URLSearchParams({ serviceKey: apiKey, pageNo: String(page), numOfRows: String(PAGE_SIZE), type: 'json' });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(`${BASE}/${OPERATION[direction]}?${params.toString()}`, { signal: controller.signal, headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { response?: { header?: { resultCode?: string }; body?: { totalCount?: number; items?: unknown } } };
      if (json.response?.header?.resultCode !== '00') throw new Error('abnormal response');
      const body = json.response.body;
      const got = Array.isArray(body?.items) ? body.items : [];
      items.push(...got);
      if (got.length === 0 || items.length >= Number(body?.totalCount ?? 0)) break;
    } finally {
      clearTimeout(timer);
    }
  }
  return items;
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers });

  const apiKey = Deno.env.get('DATA_GO_KR_KEY');
  if (!apiKey) return new Response(JSON.stringify({ error: 'not_configured' }), { status: 503, headers });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  const { data: latest } = await admin.from('icn_flight_schedule').select('synced_at').order('synced_at', { ascending: false }).limit(1).maybeSingle();
  if (latest && Date.now() - new Date(latest.synced_at).getTime() < MIN_SYNC_INTERVAL_MS) {
    return new Response(JSON.stringify({ skipped: true, lastSyncedAt: latest.synced_at }), { status: 200, headers });
  }

  let rows;
  try {
    const [dep, arr] = await Promise.all([fetchAll('dep', apiKey), fetchAll('arr', apiKey)]);
    const depRows = normalizeIcnSchedule(dep, 'dep');
    const arrRows = normalizeIcnSchedule(arr, 'arr');
    if (depRows.length === 0 || arrRows.length === 0) throw new Error('empty direction');
    rows = [...depRows, ...arrRows];
  } catch (err) {
    console.warn('[flight-schedule-sync] fetch failed:', err instanceof Error ? err.message : err);
    return new Response(JSON.stringify({ error: 'fetch_failed' }), { status: 502, headers });
  }

  const { data, error } = await admin.rpc('replace_icn_flight_schedule', { p_rows: rows });
  if (error) {
    console.error('[flight-schedule-sync] write failed:', error.message);
    return new Response(JSON.stringify({ error: 'db_write_failed' }), { status: 500, headers });
  }
  return new Response(JSON.stringify({ updated: data }), { status: 200, headers });
});
