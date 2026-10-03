/**
 * Supabase Edge Function: flight-lookup — 편명+날짜로 항공편 정보를 찾는다(항공편 입력 창의 '편명으로 불러오기')
 *
 * POST { flightNo, date: 'YYYY-MM-DD' } → { found: true, flight } | { found: false, reason: 'not_found' | 'out_of_range' | 'not_published' }
 * 로그인한 사용자만(세션 JWT) — 외부 API 호출 한도 보호.
 *
 * 순서: ① 인천 시즌 스케줄 표(icn_flight_schedule, 매일 동기화)에서 편명·날짜(기간·요일)가 맞는 줄 → 인천 출발편이면 한국공항공사 국제선에서 상대 공항 도착 시각을 한 번 더 찾는다
 *       ② 인천 표에 편명이 없으면 한국공항공사 국내선에서 찾는다.
 * 한국공항공사 응답은 24시간 보관한다(flight_lookup_cache). 못 받으면(외부 오류) 도착 시각만 비운 채 돌려주고, 보관하지 않는다.
 * 설정(한 번만): supabase secrets set DATA_GO_KR_KEY=<data.go.kr 일반 인증키> (활용신청: 한국공항공사 항공기 운항 스케줄 정보 flight-schedule)
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  buildIcnFlight,
  isValidYmd,
  kacArrivalTime,
  missReason,
  normalizeFlightNo,
  pickDomestic,
  pickIcnRowForDate,
  type IcnScheduleRow,
  type LookupResponse,
} from '../../../src/features/plan/flightLookup/schedule.ts';

const KAC_BASE = 'https://apis.data.go.kr/B551178/flight-schedule';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10000;

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

function json(body: unknown, status: number, headers: Headers) {
  return new Response(JSON.stringify(body), { status, headers });
}

/** 한국공항공사 한 번 호출(편명+날짜) — 줄 목록. 오류면 던진다 */
async function fetchKac(operation: 'int' | 'dom', flightNo: string, ymd: string, apiKey: string): Promise<unknown[]> {
  const params = new URLSearchParams({
    serviceKey: apiKey,
    pageNo: '1',
    numOfRows: '100',
    type: 'json',
    schFlightNum: flightNo,
    schDate: ymd.replaceAll('-', ''),
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${KAC_BASE}/${operation}?${params.toString()}`, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { response?: { header?: { resultCode?: string }; body?: { totalCount?: number; items?: { item?: unknown } } } };
    if (body.response?.header?.resultCode !== '00') throw new Error('abnormal response');
    const item = body.response.body?.items?.item;
    if (item == null) return [];
    return Array.isArray(item) ? item : [item];
  } finally {
    clearTimeout(timer);
  }
}

/** 보관분이 24시간 안이면 그것, 아니면 새로 받아 보관. 외부 오류는 호출한 쪽으로 던진다(보관 안 함) */
async function kacCached(admin: SupabaseClient, kind: 'kac_int' | 'kac_dom', flightNo: string, ymd: string, apiKey: string): Promise<unknown[]> {
  const cacheKey = `${flightNo}:${ymd}`;
  const { data: hit } = await admin.from('flight_lookup_cache').select('payload, fetched_at').eq('kind', kind).eq('cache_key', cacheKey).maybeSingle();
  if (hit && Date.now() - new Date(hit.fetched_at).getTime() < CACHE_TTL_MS && Array.isArray(hit.payload)) return hit.payload;
  const items = await fetchKac(kind === 'kac_int' ? 'int' : 'dom', flightNo, ymd, apiKey);
  await admin.from('flight_lookup_cache').upsert({ kind, cache_key: cacheKey, payload: items, fetched_at: new Date().toISOString() });
  return items;
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, headers);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'unauthorized' }, 401, headers);
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData.user) return json({ error: 'unauthorized' }, 401, headers);

  const apiKey = Deno.env.get('DATA_GO_KR_KEY');
  if (!apiKey) return json({ error: 'not_configured' }, 503, headers);

  let body: { flightNo?: unknown; date?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_request' }, 400, headers);
  }
  const flightNo = normalizeFlightNo(typeof body.flightNo === 'string' ? body.flightNo : '');
  const date = typeof body.date === 'string' ? body.date : '';
  if (!/^[A-Z0-9]{3,7}$/.test(flightNo) || !isValidYmd(date)) return json({ error: 'bad_request' }, 400, headers);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  // ① 인천 시즌 스케줄
  const { data: icnData, error: icnError } = await admin.from('icn_flight_schedule').select('*').eq('flight_id', flightNo);
  if (icnError) return json({ error: 'db_read_failed' }, 500, headers);
  const icnRows = (icnData ?? []) as IcnScheduleRow[];
  if (icnRows.length > 0) {
    const picked = pickIcnRowForDate(icnRows, date);
    if (!picked) return json({ found: false, reason: missReason(icnRows, date) } satisfies LookupResponse, 200, headers);
    // 도착편은 인천 도착일로 맞춰질 수 있다(밤새 오는 편) — 돌려주는 flight.date가 그 날짜
    const { row, date: flightDate } = picked;
    let arrivalTime = '';
    if (row.direction === 'dep') {
      try {
        const items = await kacCached(admin, 'kac_int', row.master_flight_id || row.flight_id, flightDate, apiKey);
        arrivalTime = kacArrivalTime(items, row.master_flight_id || row.flight_id, 'ICN', row.other_airport_code, flightDate);
      } catch (err) {
        console.warn('[flight-lookup] kac int failed:', err instanceof Error ? err.message : err);
      }
    }
    return json({ found: true, flight: buildIcnFlight(row, flightDate, arrivalTime) } satisfies LookupResponse, 200, headers);
  }

  // 인천 표가 아직 비어 있으면(첫 동기화 전) 인천 편을 '없음'으로 잘못 알리지 않도록 준비 중으로 알린다
  const { count: icnCount } = await admin.from('icn_flight_schedule').select('id', { count: 'exact', head: true });
  if (!icnCount) return json({ error: 'not_ready' }, 503, headers);

  // ② 국내선
  try {
    const items = await kacCached(admin, 'kac_dom', flightNo, date, apiKey);
    const flight = pickDomestic(items, flightNo, date);
    return json((flight ? { found: true, flight } : { found: false, reason: 'not_found' }) satisfies LookupResponse, 200, headers);
  } catch (err) {
    console.warn('[flight-lookup] kac dom failed:', err instanceof Error ? err.message : err);
    return json({ error: 'upstream_failed' }, 502, headers);
  }
});
