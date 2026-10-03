/**
 * Supabase Edge Function: incheon-board — 인천공항 출·도착 전광판 데이터
 *
 * 호출: 홈 화면이 3분마다(src/features/home/airport/useAirportBoard.ts). 응답은 항상 airport_board 표의 마지막 값이다.
 * 표가 3분보다 오래됐을 때만 외부(인천국제공항공사 '여객기 운항 현황 조회 서비스(다국어)', data.go.kr)를 부르는데,
 * 그 권한은 DB 함수 claim_airport_refresh가 한 번에 한 요청에게만 준다(0078) — 보는 사람이 많아도 3분에 출발·도착 각 1회,
 * 하루 상한(900회)을 넘으면 더 부르지 않는다(개발 계정 1,000회/일).
 *
 * 설정(한 번만): supabase secrets set INCHEON_API_KEY=<data.go.kr 일반 인증키>
 * 외부 호출이 실패하면 이전 값을 그대로 둔다(그 방향만) — 응답의 stale=true로 알린다.
 */
import { createClient } from '@supabase/supabase-js';
import {
  boardWindow,
  extractItems,
  isNormalResponse,
  normalizeBoard,
  type BoardDirection,
  type BoardFlight,
} from '../../../src/features/home/airport/boardParse.ts';

const BASE = 'https://apis.data.go.kr/B551177/StatusOfPassengerFlightsOdp';
const OPERATION: Record<BoardDirection, string> = {
  departures: 'getPassengerDeparturesOdp',
  arrivals: 'getPassengerArrivalsOdp',
};
const MIN_AGE_MS = 3 * 60 * 1000;
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

async function fetchDirection(direction: BoardDirection, apiKey: string, window: { from: string; to: string }): Promise<BoardFlight[]> {
  const params = new URLSearchParams({
    serviceKey: apiKey,
    type: 'json',
    lang: 'K',
    numOfRows: '1000',
    pageNo: '1',
    from_time: window.from,
    to_time: window.to,
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/${OPERATION[direction]}?${params.toString()}`, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!isNormalResponse(json)) throw new Error('abnormal response');
    return normalizeBoard(extractItems(json));
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const read = () =>
    admin.from('airport_board').select('departures, arrivals, fetched_at').eq('id', 'incheon').maybeSingle();

  const { data: board, error: readError } = await read();
  if (readError || !board) {
    console.error('[incheon-board] read failed:', readError?.message);
    return new Response(JSON.stringify({ error: 'board_unavailable' }), { status: 500, headers });
  }

  const apiKey = Deno.env.get('INCHEON_API_KEY');
  const age = board.fetched_at ? Date.now() - new Date(board.fetched_at).getTime() : Infinity;
  let current = board;
  let stale = age >= MIN_AGE_MS;

  if (stale && apiKey) {
    // 갱신 권한(3분에 한 번·하루 상한) — 못 받으면 마지막 값을 그대로 돌려준다
    const { data: claimed } = await admin.rpc('claim_airport_refresh');
    if (claimed === true) {
      const window = boardWindow();
      const [dep, arr] = await Promise.allSettled([
        fetchDirection('departures', apiKey, window),
        fetchDirection('arrivals', apiKey, window),
      ]);
      const next = {
        departures: dep.status === 'fulfilled' ? dep.value : (board.departures as BoardFlight[]),
        arrivals: arr.status === 'fulfilled' ? arr.value : (board.arrivals as BoardFlight[]),
      };
      for (const r of [dep, arr]) {
        if (r.status === 'rejected') console.warn('[incheon-board] fetch failed:', r.reason instanceof Error ? r.reason.message : r.reason);
      }
      // 한 방향이라도 새로 받았으면 값을 쓴다. 둘 다 실패하면 아무것도 덮어쓰지 않는다(fetched_at도 그대로)
      if (dep.status === 'fulfilled' || arr.status === 'fulfilled') {
        const fetchedAt = new Date().toISOString();
        const { error } = await admin.from('airport_board').update({ ...next, fetched_at: fetchedAt }).eq('id', 'incheon');
        if (error) console.error('[incheon-board] write failed:', error.message);
        else {
          current = { ...next, fetched_at: fetchedAt };
          stale = dep.status !== 'fulfilled' || arr.status !== 'fulfilled';
        }
      }
    }
  }

  return new Response(
    JSON.stringify({ departures: current.departures, arrivals: current.arrivals, fetchedAt: current.fetched_at, stale }),
    { status: 200, headers },
  );
});
