/**
 * Supabase Edge Function: kac-board — 김포·대구·김해·제주 등 한국공항공사 공항의 실시간 출·도착 전광판
 *
 * 호출: 공항 화면이 3분마다(src/features/home/airport/useKacBoard.ts). 응답은 항상 kac_board 표의 마지막 값이다.
 * 표가 3분보다 오래됐을 때만 외부(한국공항공사 '실시간 항공기 운항정보 조회', data.go.kr B551178/flight-status/info)를 부르는데,
 * 그 권한은 DB 함수 claim_kac_board_refresh가 한 번에 한 요청에게만 준다(0085). 13개 공항을 한 번에, 지금 −1시간 ~ +4시간만
 * 100줄씩 쪽으로 받는다(최대 MAX_PAGES쪽). 한 쪽이라도 실패하면 이번 값은 버리고 이전 값을 그대로 둔다(일부만 바뀐 전광판 방지).
 *
 * 키: supabase secrets의 DATA_GO_KR_KEY(data.go.kr 일반 인증키). 코드·레포에 넣지 않는다.
 */
import { createClient } from '@supabase/supabase-js';
import { boardWindow } from '../../../src/features/home/airport/boardParse.ts';
import { normalizeKacBoard } from '../../../src/features/home/airport/kacBoardParse.ts';

const BASE = 'https://apis.data.go.kr/B551178/flight-status/info';
const MIN_AGE_MS = 3 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;
// 한국공항공사 API는 numOfRows가 100을 넘으면 HTTP 에러(2026-10-04 확인)
const PAGE_SIZE = 100;
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

async function fetchPage(apiKey: string, window: { from: string; to: string }, page: number) {
  const params = new URLSearchParams({
    serviceKey: apiKey,
    type: 'json',
    numOfRows: String(PAGE_SIZE),
    pageNo: String(page),
    schStTime: window.from,
    schEdTime: window.to,
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}?${params.toString()}`, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const body = json?.response?.body;
    if (json?.response?.header?.resultCode !== '00' || !body) throw new Error('abnormal response');
    const raw = body.items?.item ?? [];
    const items: Record<string, unknown>[] = Array.isArray(raw) ? raw : [raw];
    return { items, total: Number(body.totalCount) || 0 };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchAll(apiKey: string): Promise<Record<string, unknown>[]> {
  const window = boardWindow();
  const first = await fetchPage(apiKey, window, 1);
  const pages = Math.min(MAX_PAGES, Math.ceil(first.total / PAGE_SIZE));
  const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, i) => fetchPage(apiKey, window, i + 2)));
  return [...first.items, ...rest.flatMap((r) => r.items)];
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const { data: row, error: readError } = await admin.from('kac_board').select('boards, fetched_at').eq('id', 'all').maybeSingle();
  if (readError || !row) {
    console.error('[kac-board] read failed:', readError?.message);
    return new Response(JSON.stringify({ error: 'board_unavailable' }), { status: 500, headers });
  }

  const apiKey = Deno.env.get('DATA_GO_KR_KEY');
  let current = row as { boards: Record<string, unknown>; fetched_at: string | null };
  const age = current.fetched_at ? Date.now() - new Date(current.fetched_at).getTime() : Infinity;
  let stale = age >= MIN_AGE_MS;

  if (stale && apiKey) {
    const { data: claimed } = await admin.rpc('claim_kac_board_refresh');
    if (claimed === true) {
      try {
        const boards = normalizeKacBoard(await fetchAll(apiKey));
        const fetchedAt = new Date().toISOString();
        const { error } = await admin.from('kac_board').update({ boards, fetched_at: fetchedAt }).eq('id', 'all');
        if (error) console.error('[kac-board] write failed:', error.message);
        else {
          current = { boards, fetched_at: fetchedAt };
          stale = false;
        }
      } catch (err) {
        console.warn('[kac-board] fetch failed:', err instanceof Error ? err.message : err);
      }
    }
  }

  return new Response(JSON.stringify({ boards: current.boards, fetchedAt: current.fetched_at, stale }), { status: 200, headers });
});
