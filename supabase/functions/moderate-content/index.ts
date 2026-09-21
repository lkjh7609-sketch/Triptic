/**
 * Supabase Edge Function: moderate-content (06-community.md §5.1 흐름도)
 *
 * POST { kind: 'post', destinationId, tripId?, body, images?: [{storagePath,width,height}] }
 * POST { kind: 'comment', postId, parentId?, body }
 *
 * 클라이언트는 이 함수를 거치지 않고는 게시물을 만들 수 없다 — 0023
 * 마이그레이션에서 posts/comments 직접 insert 정책을 안전한 값으로 좁혀
 * 놓았다(우회해도 최악이 "운영자 검토 대기"). 실제 게시 상태 결정과 행
 * 생성은 이 함수가 계산해서 security definer RPC(create_moderated_post/
 * create_moderated_comment)로 한 번에 처리한다.
 *
 * 응답 시간 예산 3초(§5.1) — 텍스트 분류 + 이미지 분류(있으면, 전부 병렬)를
 * 같은 데드라인으로 경합시킨다. 하나라도 실패/타임아웃하면 fail closed
 * (decideStatus.ts) — 절대 조용히 통과시키지 않는다.
 */
import { createClient } from '@supabase/supabase-js';
import { badwordScore } from '../../../src/features/community/moderation/badwords.ts';
import { spamScore } from '../../../src/features/community/moderation/spamHeuristics.ts';
import { decideStatus } from '../../../src/features/community/moderation/decideStatus.ts';
import { classifyText, classifyImageBytes } from '../../../src/features/community/moderation/deepseekClassifier.ts';
import { detectLanguage } from '../../../src/features/community/languageDetect.ts';

const CLASSIFIER_BUDGET_MS = 3000;

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

function jsonResponse(body: unknown, status: number, headers: Headers) {
  return new Response(JSON.stringify(body), { status, headers });
}

interface ImageInput {
  storagePath: string;
  width?: number;
  height?: number;
}

interface RequestBody {
  kind?: 'post' | 'comment';
  destinationId?: string;
  tripId?: string | null;
  postId?: string;
  parentId?: string | null;
  body?: string;
  images?: ImageInput[];
}

async function fetchImageBytes(supabaseUrl: string, storagePath: string): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  try {
    const url = `${supabaseUrl}/storage/v1/object/public/post-images/${storagePath}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const mimeType = res.headers.get('content-type') ?? 'image/webp';
    const bytes = new Uint8Array(await res.arrayBuffer());
    return { bytes, mimeType };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method Not Allowed' }, 405, headers);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ error: '인증이 필요합니다.' }, 401, headers);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY');
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return jsonResponse({ error: '인증이 유효하지 않습니다.' }, 401, headers);

  let payload: RequestBody;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: '잘못된 요청입니다.' }, 400, headers);
  }

  const kind = payload.kind;
  const text = (payload.body ?? '').trim();
  if (kind !== 'post' && kind !== 'comment') {
    return jsonResponse({ error: 'kind는 post 또는 comment여야 합니다.' }, 400, headers);
  }
  if (!text) return jsonResponse({ error: '내용을 입력해 주세요.' }, 400, headers);
  if (kind === 'post' && text.length > 2000) {
    return jsonResponse({ error: '글은 2000자를 넘을 수 없습니다.' }, 400, headers);
  }
  if (kind === 'comment' && text.length > 500) {
    return jsonResponse({ error: '댓글은 500자를 넘을 수 없습니다.' }, 400, headers);
  }
  if (kind === 'post' && !payload.destinationId) {
    return jsonResponse({ error: '여행지를 선택해 주세요.' }, 400, headers);
  }
  if (kind === 'comment' && !payload.postId) {
    return jsonResponse({ error: 'postId가 필요합니다.' }, 400, headers);
  }

  try {
    const deadline = Date.now() + CLASSIFIER_BUDGET_MS;
    const remaining = () => Math.max(500, deadline - Date.now());

    const badword = badwordScore(text);
    const spam = spamScore(text);

    const images = kind === 'post' ? (payload.images ?? []) : [];

    const [textResult, ...imageResults] = await Promise.all([
      deepseekApiKey ? classifyText(deepseekApiKey, text, remaining()) : Promise.resolve(null),
      ...images.map(async (img) => {
        if (!deepseekApiKey) return null;
        const fetched = await fetchImageBytes(supabaseUrl, img.storagePath);
        if (!fetched) return null;
        return classifyImageBytes(deepseekApiKey, fetched.bytes, fetched.mimeType, remaining());
      }),
    ]);

    const textScore = textResult?.score ?? null;
    const imageScore = images.length === 0 ? 0 : imageResults.some((r) => r == null) ? null : Math.max(...imageResults.map((r) => r!.score));
    const categories: Record<string, unknown> = {
      badword,
      spam,
      text: textResult?.categories ?? null,
      images: imageResults.map((r) => r?.categories ?? null),
    };

    const decision = decideStatus(kind, {
      badword,
      spam,
      textClassifier: textScore,
      imageClassifier: imageScore,
    });

    if (kind === 'post') {
      const { data: newId, error: rpcErr } = await userClient.rpc('create_moderated_post', {
        p_destination_id: payload.destinationId,
        p_trip_id: payload.tripId ?? null,
        p_body: text,
        p_language: detectLanguage(text),
        p_images: images.map((img, i) => ({ ...img, position: i })),
        p_status: decision.status,
        p_score: decision.score,
        p_categories: categories,
      });
      if (rpcErr) throw rpcErr;
      return jsonResponse({ id: newId, status: decision.status, failClosed: decision.failClosed }, 200, headers);
    }

    // comment: decideStatus never returns 'pending_review' for comments (see decideStatus.ts)
    const { data: newId, error: rpcErr } = await userClient.rpc('create_moderated_comment', {
      p_post_id: payload.postId,
      p_parent_id: payload.parentId ?? null,
      p_body: text,
      p_status: decision.status === 'pending_review' ? 'removed' : decision.status,
      p_score: decision.score,
      p_categories: categories,
    });
    if (rpcErr) throw rpcErr;
    return jsonResponse({ id: newId, status: decision.status, failClosed: decision.failClosed }, 200, headers);
  } catch (err) {
    console.error('[moderate-content] failed:', err instanceof Error ? err.message : err);
    return jsonResponse({ error: '게시 처리에 실패했습니다.' }, 500, headers);
  }
});
