/**
 * Supabase Edge Function: moderate-content (06-community.md §5.1 흐름도)
 *
 * POST { kind: 'post', destinationId, tripId?, body, images?: [{storagePath,width,height}] }
 * POST { kind: 'comment', postId, parentId?, body }
 * POST { kind: 'companion_post', destinationId?, title, body, startDate, endDate, groupSize }
 * POST { kind: 'companion_application', companionPostId, body }
 *
 * 클라이언트는 이 함수를 거치지 않고는 게시물을 만들 수 없다 — 0023에서
 * posts/comments 직접 insert 정책을 안전한 값으로 좁혔고, 0029에서 게시 RPC
 * (create_moderated_post/create_moderated_comment)를 service_role 전용으로
 * 바꿨다. 이 함수가 사용자 JWT를 검증한 뒤 service_role 클라이언트로 작성자 id를
 * 넘겨 RPC를 호출한다(예전엔 사용자 권한으로 RPC를 불러서, 사용자가 RPC를 직접
 * 호출해 p_status='published'로 검열을 건너뛸 수 있었다). 0032에서 동행찾기
 * 모집글/신청도 같은 배선(create_moderated_companion_post/_application)으로
 * 확장했다 — 신청 메시지는 주최자만 보지만, 상대가 읽는 사용자 생성 콘텐츠라는
 * 점에서 댓글과 동일한 검열 기준을 적용한다.
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
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  kind?: 'post' | 'comment' | 'companion_post' | 'companion_application';
  destinationId?: string;
  tripId?: string | null;
  postId?: string;
  parentId?: string | null;
  body?: string;
  images?: ImageInput[];
  title?: string; // companion_post
  startDate?: string; // companion_post, 'yyyy-MM-dd'
  endDate?: string; // companion_post, 'yyyy-MM-dd'
  groupSize?: number; // companion_post
  companionPostId?: string; // companion_application
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
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY');
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return jsonResponse({ error: '인증이 유효하지 않습니다.' }, 401, headers);
  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  let payload: RequestBody;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: '잘못된 요청입니다.' }, 400, headers);
  }

  const kind = payload.kind;
  if (kind !== 'post' && kind !== 'comment' && kind !== 'companion_post' && kind !== 'companion_application') {
    return jsonResponse({ error: 'kind 값이 올바르지 않습니다.' }, 400, headers);
  }

  const text = (payload.body ?? '').trim();
  const isCompanionApplication = kind === 'companion_application';
  // 신청 메시지는 선택 사항이라 빈 문자열을 허용한다 — 그 외 kind는 본문 필수.
  if (!isCompanionApplication && !text) return jsonResponse({ error: '내용을 입력해 주세요.' }, 400, headers);
  if (kind === 'post' && text.length > 2000) {
    return jsonResponse({ error: '글은 2000자를 넘을 수 없습니다.' }, 400, headers);
  }
  if (kind === 'comment' && text.length > 500) {
    return jsonResponse({ error: '댓글은 500자를 넘을 수 없습니다.' }, 400, headers);
  }
  // 여행지는 선택 사항이다(0026에서 posts.destination_id nullable). 값이 오면 형식만 확인한다.
  if ((kind === 'post' || kind === 'companion_post') && payload.destinationId && !UUID_RE.test(payload.destinationId)) {
    return jsonResponse({ error: '여행지 값이 올바르지 않습니다.' }, 400, headers);
  }
  if (kind === 'comment' && !payload.postId) {
    return jsonResponse({ error: 'postId가 필요합니다.' }, 400, headers);
  }

  let classificationText = text; // companion_post는 제목도 검열 대상에 포함시킨다
  if (kind === 'companion_post') {
    const title = (payload.title ?? '').trim();
    if (!title || title.length > 100) return jsonResponse({ error: '제목은 1~100자여야 합니다.' }, 400, headers);
    if (!text || text.length > 2000) return jsonResponse({ error: '본문은 1~2000자여야 합니다.' }, 400, headers);
    if (!payload.startDate || !payload.endDate || payload.startDate > payload.endDate) {
      return jsonResponse({ error: '날짜를 확인해 주세요.' }, 400, headers);
    }
    const groupSize = payload.groupSize ?? 0;
    if (!Number.isInteger(groupSize) || groupSize < 2 || groupSize > 20) {
      return jsonResponse({ error: '모집 인원은 2~20명이어야 합니다.' }, 400, headers);
    }
    classificationText = `${title}\n${text}`;
  }
  if (isCompanionApplication) {
    if (!payload.companionPostId) return jsonResponse({ error: 'companionPostId가 필요합니다.' }, 400, headers);
    if (text.length > 500) return jsonResponse({ error: '메시지는 500자 이내여야 합니다.' }, 400, headers);
  }

  try {
    const deadline = Date.now() + CLASSIFIER_BUDGET_MS;
    const remaining = () => Math.max(500, deadline - Date.now());

    const images = kind === 'post' ? (payload.images ?? []) : [];
    const skipClassification = isCompanionApplication && classificationText.length === 0;

    let decision: ReturnType<typeof decideStatus>;
    let categories: Record<string, unknown> = { badword: 0, spam: 0, text: null, images: [] };

    if (skipClassification) {
      decision = { status: 'published', score: 0, failClosed: false };
    } else {
      const badword = badwordScore(classificationText);
      const spam = spamScore(classificationText);

      const [textResult, ...imageResults] = await Promise.all([
        deepseekApiKey ? classifyText(deepseekApiKey, classificationText, remaining()) : Promise.resolve(null),
        ...images.map(async (img) => {
          if (!deepseekApiKey) return null;
          const fetched = await fetchImageBytes(supabaseUrl, img.storagePath);
          if (!fetched) return null;
          return classifyImageBytes(deepseekApiKey, fetched.bytes, fetched.mimeType, remaining());
        }),
      ]);

      const textScore = textResult?.score ?? null;
      const imageScore = images.length === 0 ? 0 : imageResults.some((r) => r == null) ? null : Math.max(...imageResults.map((r) => r!.score));
      categories = {
        badword,
        spam,
        text: textResult?.categories ?? null,
        images: imageResults.map((r) => r?.categories ?? null),
      };

      const decisionKind = kind === 'post' || kind === 'companion_post' ? 'post' : 'comment';
      decision = decideStatus(decisionKind, {
        badword,
        spam,
        textClassifier: textScore,
        imageClassifier: imageScore,
      });
    }

    if (kind === 'post') {
      const { data: newId, error: rpcErr } = await adminClient.rpc('create_moderated_post', {
        p_author_id: user.id,
        p_destination_id: payload.destinationId || null,
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

    if (kind === 'comment') {
      // decideStatus never returns 'pending_review' for comments (see decideStatus.ts)
      const { data: newId, error: rpcErr } = await adminClient.rpc('create_moderated_comment', {
        p_author_id: user.id,
        p_post_id: payload.postId,
        p_parent_id: payload.parentId ?? null,
        p_body: text,
        p_status: decision.status === 'pending_review' ? 'removed' : decision.status,
        p_score: decision.score,
        p_categories: categories,
      });
      if (rpcErr) throw rpcErr;
      return jsonResponse({ id: newId, status: decision.status, failClosed: decision.failClosed }, 200, headers);
    }

    if (kind === 'companion_post') {
      const { data: newId, error: rpcErr } = await adminClient.rpc('create_moderated_companion_post', {
        p_author_id: user.id,
        p_destination_id: payload.destinationId || null,
        p_title: payload.title!.trim(),
        p_body: text,
        p_start_date: payload.startDate,
        p_end_date: payload.endDate,
        p_group_size: payload.groupSize,
        p_status: decision.status,
        p_score: decision.score,
        p_categories: categories,
      });
      if (rpcErr) throw rpcErr;
      const publicStatus = decision.status === 'published' ? 'recruiting' : decision.status;
      return jsonResponse({ id: newId, status: publicStatus, failClosed: decision.failClosed }, 200, headers);
    }

    // companion_application: decideStatus는 'comment' 기준이라 'published'|'removed'만 나온다
    const appStatus = decision.status === 'published' ? 'pending' : 'removed';
    const { data: newId, error: rpcErr } = await adminClient.rpc('create_moderated_companion_application', {
      p_applicant_id: user.id,
      p_post_id: payload.companionPostId,
      p_message: text || null,
      p_status: appStatus,
      p_score: decision.score,
      p_categories: categories,
    });
    if (rpcErr) throw rpcErr;
    return jsonResponse({ id: newId, status: appStatus, failClosed: decision.failClosed }, 200, headers);
  } catch (err) {
    console.error('[moderate-content] failed:', err instanceof Error ? err.message : err);
    return jsonResponse({ error: '게시 처리에 실패했습니다.' }, 500, headers);
  }
});
