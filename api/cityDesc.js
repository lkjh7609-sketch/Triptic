// Vercel Serverless Function: AI 도시 소개
// Endpoint: GET /api/cityDesc?city=Kyoto&locale=ja
//
// ai_recommendation_cache(kind='city_desc')에 언어별로 영구 캐시한다. 같은 도시·언어
// 조합은 한 번만 LLM을 부른다(만료 없음 — 앱은 0049 RPC로 이 캐시를 먼저 직접 읽는다).
import { requireUser } from './_lib/auth.js';
import { DailyLimitError, takeAiQuota } from './_lib/aiQuota.js';
import { applyCors, createRateLimiter, sanitizeInput, normalizeKey, parseLocale, LOCALE_LANGUAGE_NAME } from './_lib/http.js';
import { chatCompletion, hasLlmProvider } from './_lib/llm.js';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';

// 한 번 생성한 결과는 계속 쓴다(expires_at은 컬럼 호환용 먼 미래 값)
const NEVER_EXPIRES = '9999-12-31T00:00:00Z';
const isRateLimited = createRateLimiter(30);

export default async function handler(req, res) {
    applyCors(req, res, 'GET,OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
    if (isRateLimited(req)) return res.status(429).json({ error: 'rate_limited' });
    // AI(LLM) 호출은 비용이 드는 API라 로그인 사용자에게만 연다. 캐시 읽기는 앱이 DB 함수로 직접 하므로 비로그인도 캐시된 결과는 본다
    const user = await requireUser(req, res);
    if (!user) return;

    const city = sanitizeInput(req.query?.city, 60);
    const locale = parseLocale(req.query?.locale);
    if (!city) return res.status(400).json({ error: 'city_required' });

    const db = supabaseAdmin();
    const cacheKey = { kind: 'city_desc', city_key: normalizeKey(city), place_key: '', category: 'all', locale };

    if (db) {
        const { data: hit, error } = await db
            .from('ai_recommendation_cache')
            .select('payload')
            .match(cacheKey)
            .maybeSingle();
        if (error) console.warn('[cityDesc] cache read failed:', error.message);
        if (typeof hit?.payload?.description === 'string') {
            res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
            return res.status(200).json({ success: true, description: hit.payload.description, cached: true });
        }
    }

    if (!hasLlmProvider()) return res.status(503).json({ error: 'llm_unavailable' });

    try {
        // 캐시에 없어 LLM을 새로 부르는 경우만 로그인 사용자별 하루 한도에서 센다(캐시로 답하는 요청은 안 셈)
        await takeAiQuota(db, user.id, 'cityDesc');
        const result = await chatCompletion({
            system: 'You are an expert travel copywriter. Reply with the description text only, no headings or markdown.',
            user: `Write an inviting, useful introduction to "${city}" for travelers in about 3-4 sentences (roughly 300 characters for CJK languages, 80 words for English). Cover the atmosphere, what the city is known for, and what to look forward to. Write it in ${LOCALE_LANGUAGE_NAME[locale]}.`,
            timeoutMs: 9000,
        });
        const description = result.content.replace(/^["'“]|["'”]$/g, '').trim().slice(0, 1200);

        if (db) {
            const { error } = await db.from('ai_recommendation_cache').upsert(
                { ...cacheKey, payload: { description }, provider: result.provider, model_used: result.model, hit_count: 0, created_at: new Date().toISOString(), expires_at: NEVER_EXPIRES },
                { onConflict: 'kind,city_key,place_key,category,locale' },
            );
            if (error) console.warn('[cityDesc] cache write failed:', error.message);
        }

        res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
        return res.status(200).json({ success: true, description, cached: false });
    } catch (e) {
        if (e instanceof DailyLimitError) return res.status(429).json({ error: 'daily_limit', limit: e.limit });
        console.warn('[cityDesc] LLM call failed:', e instanceof Error ? e.message : e);
        return res.status(502).json({ error: 'llm_failed' });
    }
}
