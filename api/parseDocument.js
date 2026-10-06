// Vercel Serverless Function: 예약 서류 인식 (Supabase Edge Function parse-booking을 대신한다)
// Endpoint: POST /api/parseDocument  { documentId }
//           Authorization: Bearer <Supabase access token>
//
// 흐름: 문서 확인(RLS) → 하루 30건 한도 → Storage에서 파일 → 글자 뽑기(PDF 첫 장 글자층 / 스캔본·사진은
// Google Vision OCR, 첫 장만) → 파이프라인(보정 규칙 → 🔒 마스킹 → DeepSeek → 검증) → bookings 저장.
// 응답 모양은 예전 엣지 함수와 같다: { documentId, bookings, parserUsed, warnings }.
//
// 사용자 권한 클라이언트(anon 키 + 호출자 토큰)로 documents·trips·storage·bookings를 다뤄 RLS가 그대로
// 적용된다(본인 문서만). service_role은 usage_events(남용 방어 한도)에만 쓴다.
// 원문·추출 글은 로그에 남기지 않는다.
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { applyCors, createRateLimiter } from './_lib/http.js';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { createAirportIndex, runBookingPipeline } from './_lib/documents/pipeline.js';
import { extractDocumentText, UnsupportedDocumentError } from './_lib/documents/extract.js';
import { GoogleCapError, takeGoogleCall } from './_lib/googleCap.js';

const DAILY_LIMIT = 30; // 04-document-ai.md §11.5
const isRateLimited = createRateLimiter(20);

let airportsPromise;
function loadAirports() {
    airportsPromise ??= readFile(new URL('../data/airports.json', import.meta.url), 'utf8').then((raw) => createAirportIndex(JSON.parse(raw)));
    return airportsPromise;
}

function userClient(token) {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) return null;
    return createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
}

export default async function handler(req, res) {
    applyCors(req, res, 'POST,OPTIONS', 'Content-Type, Authorization');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    if (isRateLimited(req)) return res.status(429).json({ error: '잠시 후 다시 시도해 주세요.', code: 'RATE_LIMITED' });

    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const db = token ? userClient(token) : null;
    const admin = supabaseAdmin();
    if (!db || !admin) return res.status(token ? 503 : 401).json({ error: token ? '서버 설정이 필요합니다.' : '인증이 필요합니다.' });

    const { data: userData } = await db.auth.getUser(token);
    const user = userData?.user;
    if (!user) return res.status(401).json({ error: '인증이 유효하지 않습니다.' });

    let body = req.body;
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
        } catch {
            body = null;
        }
    }
    const documentId = typeof body?.documentId === 'string' ? body.documentId : null;
    if (!documentId) return res.status(400).json({ error: 'documentId가 필요합니다.' });

    // §11.5: 하루 30건 — 서버만 기록하는 usage_events로 판정
    const { data: used } = await admin.rpc('usage_in_window', { p_user_id: user.id, p_kind: 'document.parse', p_window: '24 hours' });
    if ((used ?? 0) >= DAILY_LIMIT) {
        await admin.from('usage_events').insert({ user_id: user.id, kind: 'limit.reached', meta: { limitedKind: 'document.parse' } });
        return res.status(429).json({ error: '오늘은 여기까지예요. 내일 다시 시도해 주세요.', code: 'RATE_LIMITED' });
    }

    const { data: doc, error: docErr } = await db.from('documents').select('id, trip_id, storage_path, mime_type').eq('id', documentId).single();
    if (docErr || !doc) return res.status(404).json({ error: '문서를 찾을 수 없습니다.' });
    const { data: trip } = await db.from('trips').select('start_date, end_date').eq('id', doc.trip_id).single();
    if (!trip?.start_date || !trip?.end_date) return res.status(400).json({ error: '여행 기간이 설정되지 않아 검증할 수 없습니다.' });

    await db.from('documents').update({ parse_status: 'processing' }).eq('id', doc.id);

    try {
        const { data: blob, error: dlErr } = await db.storage.from('vouchers').download(doc.storage_path);
        if (dlErr || !blob) throw new Error(`download failed: ${dlErr?.message}`);
        const bytes = new Uint8Array(await blob.arrayBuffer());

        const { text, fromOcr, pageCount } = await extractDocumentText(bytes, doc.mime_type, {
            // 글자 인식(Vision)은 서버 전체 월 한도 안에서만 — 넘으면 사용자에게 안내
            beforeVision: async () => {
                try {
                    await takeGoogleCall(admin, 'vision');
                } catch (e) {
                    if (e instanceof GoogleCapError) throw new UnsupportedDocumentError('이번 달 서류 인식 한도를 모두 썼어요. 다음 달에 다시 시도해 주세요.');
                    throw e;
                }
            },
        });
        const result = await runBookingPipeline(
            { text, fromOcr, tripStartDate: trip.start_date, tripEndDate: trip.end_date },
            { airports: await loadAirports(), keys: { deepseekApiKey: process.env.DEEPSEEK_API_KEY, openrouterApiKey: process.env.OPENROUTER_API_KEY } },
        );

        if (result.bookings.length > 0) {
            const rows = result.bookings.map((b) => ({
                trip_id: doc.trip_id,
                document_id: doc.id,
                type: b.kind,
                parsed: b,
                confidence: {},
                confirmed_by_user: false,
                parser_version: result.parserUsed,
            }));
            const { error: insErr } = await db.from('bookings').insert(rows);
            if (insErr) throw new Error(`bookings insert failed: ${insErr.message}`);
        }
        await db.from('documents').update({ parse_status: 'parsed', page_count: pageCount }).eq('id', doc.id);
        // 읽은 쪽 수(첫 장만 읽으므로 1)로 기록 — 한도는 건수 기준
        await admin.from('usage_events').insert({ user_id: user.id, kind: 'document.parse', quantity: 1, trip_id: doc.trip_id, meta: { ocr: fromOcr, pages: pageCount } });

        return res.status(200).json({ documentId: doc.id, bookings: result.bookings, parserUsed: result.parserUsed, warnings: result.warnings });
    } catch (e) {
        const unsupported = e instanceof UnsupportedDocumentError;
        const message = unsupported ? e.message : '문서를 처리하는 중 오류가 발생했습니다.';
        await db.from('documents').update({ parse_status: 'failed', parse_error: message }).eq('id', doc.id);
        console.error('[parseDocument] failed:', e instanceof Error ? e.message : e);
        return res.status(unsupported ? 422 : 500).json({ error: message });
    }
}
