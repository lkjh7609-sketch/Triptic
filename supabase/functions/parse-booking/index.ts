/**
 * Supabase Edge Function: parse-booking (04-document-ai.md §2 전체 파이프라인)
 *
 * POST { documentId: string }
 * Authorization: 호출한 사용자의 Supabase 세션 JWT(클라이언트가 그대로 전달) —
 * 이 토큰으로 만든 클라이언트가 documents/trips/bookings에 접근하므로 RLS가
 * 그대로 적용된다(본인 문서만 처리 가능). service_role은 usage_events
 * 읽기/쓰기(§11.5 남용 방어)에만 별도로 쓴다 — 0010/0012에서 이미
 * authenticated/anon의 usage_events 접근을 막아뒀기 때문이다.
 *
 * ⚠️ 배포 전 필요한 시크릿(전부 Supabase 프로젝트 시크릿 — Vercel 환경변수와
 * 별개다): SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
 * DEEPSEEK_API_KEY.
 * `supabase secrets set --env-file .env.functions` 또는 대시보드에서 등록.
 *
 * ⚠️ 이 파일 자체는 로컬에 Deno가 없어 실행해보지 못했다 — 배포 후 가장
 * 먼저 실제 텍스트 PDF 1건으로 전체 흐름을 확인할 것.
 */
import { createClient } from '@supabase/supabase-js';
import { redact } from '../../../src/features/documents/parseBooking/redact.ts';
import { createAirportIndex } from '../../../src/features/documents/parseBooking/airports.ts';
import { ALL_PARSERS, selectParser } from '../../../src/features/documents/parseBooking/parsers/index.ts';
import { verifyParsedFlight, verifyParsedLodging } from '../../../src/features/documents/parseBooking/validate.ts';
import { extractWithLLM } from '../../../src/features/documents/parseBooking/llm.ts';
import type { ParsedBooking } from '../../../src/features/documents/parseBooking/schema.ts';
import { extractText, UnsupportedDocumentError } from './extractText.ts';
import { applySourceWeight, sourceWeight } from './sourceWeight.ts';
import airportsJson from '../../../data/airports.json' with { type: 'json' };

const DAILY_LIMIT = 30; // §11.5

function corsHeaders(origin: string | null) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
  }
  // supabase-js가 모든 요청에 자동으로 붙이는 헤더(apikey, x-client-info)까지
  // 허용해야 한다 — 빠지면 프리플라이트는 200이 나와도 브라우저가 실제 요청을
  // 자체적으로 막아버려서(네트워크 로그에 POST 자체가 안 찍힘) 원인 파악이 어렵다.
  headers.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  return headers;
}

function jsonResponse(body: unknown, status: number, headers: Headers) {
  return new Response(JSON.stringify(body), { status, headers });
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method Not Allowed' }, 405, headers);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ error: '인증이 필요합니다.' }, 401, headers);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // 사용자 권한(RLS 적용) 클라이언트 — 본인 문서/여행만 접근 가능
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  // §11.5 남용 방어 한도 확인·기록 전용 — usage_events는 authenticated/anon 접근이
  // 막혀 있어(0010/0012) service_role이 필요하다
  const serviceClient = createClient(supabaseUrl, serviceKey);

  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return jsonResponse({ error: '인증이 유효하지 않습니다.' }, 401, headers);

  let body: { documentId?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: '잘못된 요청입니다.' }, 400, headers);
  }
  if (!body.documentId) return jsonResponse({ error: 'documentId가 필요합니다.' }, 400, headers);

  // §11.5: 하루 30건 — 서버만 기록하는 usage_events로 판정
  const { data: used } = await serviceClient.rpc('usage_in_window', {
    p_user_id: user.id,
    p_kind: 'document.parse',
    p_window: '24 hours',
  });
  if ((used ?? 0) >= DAILY_LIMIT) {
    await serviceClient
      .from('usage_events')
      .insert({ user_id: user.id, kind: 'limit.reached', meta: { limitedKind: 'document.parse' } });
    // §11.5: "유료로 전환하세요"가 아니라 "오늘은 여기까지예요"
    return jsonResponse({ error: '오늘은 여기까지예요. 내일 다시 시도해 주세요.', code: 'RATE_LIMITED' }, 429, headers);
  }

  const { data: doc, error: docErr } = await userClient
    .from('documents')
    .select('id, trip_id, storage_path, mime_type, size_bytes')
    .eq('id', body.documentId)
    .single();
  if (docErr || !doc) return jsonResponse({ error: '문서를 찾을 수 없습니다.' }, 404, headers);

  const { data: trip } = await userClient
    .from('trips')
    .select('start_date, end_date')
    .eq('id', doc.trip_id)
    .single();
  if (!trip?.start_date || !trip?.end_date) {
    return jsonResponse({ error: '여행 기간이 설정되지 않아 검증할 수 없습니다.' }, 400, headers);
  }

  await userClient.from('documents').update({ parse_status: 'processing' }).eq('id', doc.id);

  try {
    const { data: fileBlob, error: dlErr } = await userClient.storage.from('vouchers').download(doc.storage_path);
    if (dlErr || !fileBlob) throw new Error(`파일을 불러오지 못했습니다: ${dlErr?.message}`);
    const bytes = new Uint8Array(await fileBlob.arrayBuffer());

    const { text: rawText, pageCount } = await extractText(bytes, doc.mime_type);
    // §1 "원문 텍스트를 저장하거나 로그에 남기지 않는다" — 마스킹 전 원문은 이 함수
    // 스코프를 벗어나는 순간(반환·로그) 없이 로컬 변수로만 존재하고 GC된다.
    const { text: maskedText } = redact(rawText);

    const airports = createAirportIndex(airportsJson as Record<string, { name: string; city: string; country: string; lat: number; lng: number; tz: string }>);
    const parseCtx = { tripStartDate: trip.start_date, tripEndDate: trip.end_date, locale: 'ko' as const, airports };
    const verifyCtx = { airports, tripStartDate: trip.start_date, tripEndDate: trip.end_date };

    let bookings: ParsedBooking[] = [];
    let parserUsed = '';
    let detectScore: number | undefined;

    const matched = selectParser(ALL_PARSERS, maskedText);
    if (matched) {
      detectScore = matched.detect(maskedText);
      bookings = matched.parse(maskedText, parseCtx);
      parserUsed = `${matched.id}@${matched.version}`;
    }

    const warnings: string[] = [];
    if (bookings.length === 0) {
      const hints = matched ? `(결정론적 파서 ${matched.id} 시도했으나 결과 없음)` : '';
      const llmResult = await extractWithLLM(maskedText, hints, trip.start_date, trip.end_date, {
        deepseekApiKey: Deno.env.get('DEEPSEEK_API_KEY') ?? undefined,
      });
      if (llmResult) {
        bookings = llmResult.bookings;
        parserUsed = llmResult.parserUsed;
      } else {
        warnings.push('자동 인식에 실패했습니다 — 직접 입력해 주세요.');
      }
    }

    // §7 결정론적 검증 — flight/lodging만 검증기가 있다(rail/car_rental/activity는
    // 다음 라운드, 검증 없이 파서/LLM이 준 신뢰도를 그대로 출처 가중치만 적용한다)
    const verified: ParsedBooking[] = [];
    for (const b of bookings) {
      if (b.kind === 'flight') {
        const { flight, warnings: w } = verifyParsedFlight(b, verifyCtx);
        verified.push(flight);
        warnings.push(...w);
      } else if (b.kind === 'lodging') {
        const { lodging, warnings: w } = verifyParsedLodging(b, verifyCtx);
        verified.push(lodging);
        warnings.push(...w);
      } else {
        verified.push(b);
      }
    }

    const weight = sourceWeight(parserUsed, detectScore);
    const weighted = verified.map((b) => applySourceWeight(b, weight));

    if (weighted.length > 0) {
      const rows = weighted.map((b) => ({
        trip_id: doc.trip_id,
        document_id: doc.id,
        type: b.kind,
        parsed: b,
        confidence: {}, // 필드별 신뢰도는 parsed 안에 이미 포함(§6.4 {value,confidence}) — 별도 집계는 커밋 시점에 계산
        confirmed_by_user: false,
        parser_version: parserUsed,
      }));
      await userClient.from('bookings').insert(rows);
    }

    await userClient
      .from('documents')
      .update({ parse_status: 'parsed', page_count: pageCount })
      .eq('id', doc.id);

    await serviceClient
      .from('usage_events')
      .insert({ user_id: user.id, kind: 'document.parse', quantity: pageCount, trip_id: doc.trip_id });

    return jsonResponse(
      { documentId: doc.id, bookings: weighted, parserUsed, warnings },
      200,
      headers,
    );
  } catch (err) {
    const message = err instanceof UnsupportedDocumentError ? err.message : '문서를 처리하는 중 오류가 발생했습니다.';
    await userClient
      .from('documents')
      .update({ parse_status: 'failed', parse_error: message })
      .eq('id', doc.id);
    console.error('[parse-booking] failed:', err instanceof Error ? err.message : err);
    return jsonResponse({ error: message }, err instanceof UnsupportedDocumentError ? 422 : 500, headers);
  }
});
