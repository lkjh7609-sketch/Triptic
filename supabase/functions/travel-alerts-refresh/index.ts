/**
 * Supabase Edge Function: travel-alerts-refresh — 외교부 국가·지역별 여행경보를 받아 travel_alerts에 통째로 저장
 *
 * 호출: pg_cron이 매일 오전 9시(KST, 0082 마이그레이션). 6시간 안에 이미 갱신됐으면 아무것도 하지 않는다(anon 키로도 불리므로 외부 호출 남용 방지).
 * 설정(한 번만): supabase secrets set MOFA_API_KEY=<data.go.kr 일반 인증키>  (활용신청: '외교부_국가∙지역별 여행경보')
 * 실패하면 이전 목록을 그대로 둔다 — 빈 응답·오류 응답으로는 덮어쓰지 않는다.
 */
import { createClient } from '@supabase/supabase-js';
import { extractAlarmItems, normalizeAlarms } from '../../../src/features/travelAlerts/alarmParse.ts';

const ENDPOINT = 'https://apis.data.go.kr/1262000/TravelAlarmService2/getTravelAlarmList2';
const MIN_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 15000;

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

async function fetchAlarms(apiKey: string): Promise<unknown[]> {
  const params = new URLSearchParams({ serviceKey: apiKey, numOfRows: '500', pageNo: '1', returnType: 'JSON' });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${ENDPOINT}?${params.toString()}`, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = extractAlarmItems(await res.json());
    if (!items) throw new Error('abnormal response');
    return items;
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers });

  const apiKey = Deno.env.get('MOFA_API_KEY');
  if (!apiKey) return new Response(JSON.stringify({ error: 'not_configured' }), { status: 503, headers });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const { data: latest } = await admin
    .from('travel_alerts')
    .select('fetched_at')
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latest && Date.now() - new Date(latest.fetched_at).getTime() < MIN_REFRESH_INTERVAL_MS) {
    return new Response(JSON.stringify({ skipped: true, lastFetchedAt: latest.fetched_at }), { status: 200, headers });
  }

  let rows;
  try {
    rows = normalizeAlarms(await fetchAlarms(apiKey));
  } catch (err) {
    console.warn('[travel-alerts-refresh] fetch failed:', err instanceof Error ? err.message : err);
    return new Response(JSON.stringify({ error: 'fetch_failed' }), { status: 502, headers });
  }
  if (rows.length === 0) {
    return new Response(JSON.stringify({ error: 'empty_response' }), { status: 502, headers });
  }

  const { data, error } = await admin.rpc('replace_travel_alerts', { p_rows: rows });
  if (error) {
    console.error('[travel-alerts-refresh] write failed:', error.message);
    return new Response(JSON.stringify({ error: 'db_write_failed' }), { status: 500, headers });
  }
  return new Response(JSON.stringify({ updated: data, countries: new Set(rows.map((r) => r.country_code)).size }), { status: 200, headers });
});
