/**
 * Supabase Edge Function: airport-parking — 공항 주차장 남은 대수·혼잡도
 *
 * 호출: 공항 화면이 2분마다(src/features/home/airport/useAirportParking.ts). 응답은 항상 airport_parking 표의 마지막 값이다.
 * 표가 2분보다 오래됐을 때만 외부(data.go.kr) 3개 API를 부르는데, 그 권한은 DB 함수 claim_parking_refresh가
 * 한 번에 한 요청에게만 준다(0084) — 보는 사람이 많아도 2분에 3회, 하루 상한 2,400회.
 *  · 한국공항공사 parking-realtime-status(면수·대수) + parking-congestion(원활·혼잡·만차) → kac
 *  · 인천국제공항공사 StatusOfParking(T1·T2 층별) → icn
 * 출처마다 실패하면 그쪽 이전 값을 그대로 둔다. 혼잡도 API만 실패하면 직전 판정을 이어 쓴다(parkingParse.normalizeKac).
 *
 * 키: supabase secrets의 DATA_GO_KR_KEY(data.go.kr 일반 인증키 — 계정에 하나라 INCHEON_API_KEY와 같은 값). 코드·레포에 넣지 않는다.
 */
import { createClient } from '@supabase/supabase-js';
import {
  extractParkingItems,
  isNormalParkingResponse,
  normalizeIcn,
  normalizeKac,
  type ParkingLot,
} from '../../../src/features/home/airport/parkingParse.ts';

const KAC_STATUS = 'https://apis.data.go.kr/B551178/parking-realtime-status/info';
const KAC_CONGESTION = 'https://apis.data.go.kr/B551178/parking-congestion/info';
const ICN = 'https://apis.data.go.kr/B551177/StatusOfParking/getTrackingParking';
const MIN_AGE_MS = 2 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;

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

async function fetchItems(url: string, apiKey: string): Promise<Record<string, unknown>[]> {
  // 한국공항공사 API는 numOfRows가 100을 넘으면 HTTP 에러(2026-10-04 확인) — 25곳·19곳이라 100이면 충분
  const params = new URLSearchParams({ serviceKey: apiKey, type: 'json', numOfRows: '100', pageNo: '1' });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${url}?${params.toString()}`, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!isNormalParkingResponse(json)) throw new Error('abnormal response');
    const items = extractParkingItems(json);
    if (items.length === 0) throw new Error('empty');
    return items;
  } finally {
    clearTimeout(timer);
  }
}

const reason = (r: PromiseSettledResult<unknown>) =>
  r.status === 'rejected' ? (r.reason instanceof Error ? r.reason.message : String(r.reason)) : '';

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const { data: row, error: readError } = await admin
    .from('airport_parking')
    .select('kac, kac_fetched_at, icn, icn_fetched_at')
    .eq('id', 'all')
    .maybeSingle();
  if (readError || !row) {
    console.error('[airport-parking] read failed:', readError?.message);
    return new Response(JSON.stringify({ error: 'parking_unavailable' }), { status: 500, headers });
  }

  const apiKey = Deno.env.get('DATA_GO_KR_KEY');
  let current = row as { kac: ParkingLot[]; kac_fetched_at: string | null; icn: ParkingLot[]; icn_fetched_at: string | null };
  const oldest = Math.min(
    current.kac_fetched_at ? new Date(current.kac_fetched_at).getTime() : 0,
    current.icn_fetched_at ? new Date(current.icn_fetched_at).getTime() : 0,
  );

  if (Date.now() - oldest >= MIN_AGE_MS && apiKey) {
    // 갱신 권한(2분에 한 번·하루 상한) — 못 받으면 마지막 값을 그대로 돌려준다
    const { data: claimed } = await admin.rpc('claim_parking_refresh');
    if (claimed === true) {
      const [status, congestion, icn] = await Promise.allSettled([
        fetchItems(KAC_STATUS, apiKey),
        fetchItems(KAC_CONGESTION, apiKey),
        fetchItems(ICN, apiKey),
      ]);
      for (const [name, r] of [['status', status], ['congestion', congestion], ['icn', icn]] as const) {
        if (r.status === 'rejected') console.warn(`[airport-parking] ${name} failed:`, reason(r));
      }
      const now = new Date().toISOString();
      const update: Record<string, unknown> = {};
      if (status.status === 'fulfilled') {
        update.kac = normalizeKac(status.value, congestion.status === 'fulfilled' ? congestion.value : [], current.kac);
        update.kac_fetched_at = now;
      }
      if (icn.status === 'fulfilled') {
        update.icn = normalizeIcn(icn.value);
        update.icn_fetched_at = now;
      }
      if (Object.keys(update).length > 0) {
        const { error } = await admin.from('airport_parking').update(update).eq('id', 'all');
        if (error) console.error('[airport-parking] write failed:', error.message);
        else current = { ...current, ...update } as typeof current;
      }
    }
  }

  const ageMin = (at: string | null) => (at ? Date.now() - new Date(at).getTime() : Infinity);
  return new Response(
    JSON.stringify({
      lots: [...current.icn, ...current.kac],
      fetchedAt: { kac: current.kac_fetched_at, icn: current.icn_fetched_at },
      // 출처별로 2분 넘게 못 받고 있으면 화면이 '잠시 지난 정보'라고 알린다
      stale: { kac: ageMin(current.kac_fetched_at) > 3 * MIN_AGE_MS, icn: ageMin(current.icn_fetched_at) > 3 * MIN_AGE_MS },
    }),
    { status: 200, headers },
  );
});
