// Vercel Serverless Function: AI 도시 소개
// Endpoint: GET /api/cityDesc?city=Kyoto&locale=ja
//
// ai_recommendation_cache(kind='city_desc', 180일)에 언어별로 캐시한다. 같은 도시·언어
// 조합은 한 번만 LLM을 부른다.
import { applyCors, createRateLimiter, sanitizeInput, normalizeKey, parseLocale, LOCALE_LANGUAGE_NAME } from './_lib/http.js';
import { chatCompletion, hasLlmProvider } from './_lib/llm.js';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';

const CACHE_TTL_DAYS = 180;
const isRateLimited = createRateLimiter(30);

export default async function handler(req, res) {
    applyCors(req, res, 'GET,OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
    if (isRateLimited(req)) return res.status(429).json({ error: 'rate_limited' });

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
            .gt('expires_at', new Date().toISOString())
            .maybeSingle();
        if (error) console.warn('[cityDesc] cache read failed:', error.message);
        if (typeof hit?.payload?.description === 'string') {
            res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
            return res.status(200).json({ success: true, description: hit.payload.description, cached: true });
        }
    }

    if (!hasLlmProvider()) return res.status(503).json({ error: 'llm_unavailable' });

    try {
        const result = await chatCompletion({
            system: 'You are an expert travel copywriter. Reply with the description text only, no headings or markdown.',
            user: `Write an inviting, useful introduction to "${city}" for travelers in about 3-4 sentences (roughly 300 characters for CJK languages, 80 words for English). Cover the atmosphere, what the city is known for, and what to look forward to. Write it in ${LOCALE_LANGUAGE_NAME[locale]}.`,
            timeoutMs: 9000,
        });
        const description = result.content.replace(/^["'“]|["'”]$/g, '').trim().slice(0, 1200);

        if (db) {
            const expiresAt = new Date(Date.now() + CACHE_TTL_DAYS * 86_400_000).toISOString();
            const { error } = await db.from('ai_recommendation_cache').upsert(
                { ...cacheKey, payload: { description }, provider: result.provider, model_used: result.model, hit_count: 0, created_at: new Date().toISOString(), expires_at: expiresAt },
                { onConflict: 'kind,city_key,place_key,category,locale' },
            );
            if (error) console.warn('[cityDesc] cache write failed:', error.message);
        }

        res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
        return res.status(200).json({ success: true, description, cached: false });
    } catch (e) {
        console.warn('[cityDesc] LLM call failed:', e instanceof Error ? e.message : e);
        return res.status(502).json({ error: 'llm_failed' });
    }
}
