import { createClient } from '@supabase/supabase-js';

/**
 * 로그인 확인 — Authorization: Bearer <Supabase access token>을 Supabase Auth로 검증한다.
 * 비용이 드는 API(AI 호출)를 로그인 사용자에게만 열 때 쓴다. 통과하면 사용자를, 아니면 응답(401/503)을 보내고 null을 돌려준다.
 * 호출부는 `const user = await requireUser(req, res); if (!user) return;` 로 쓴다.
 */
export async function requireUser(req, res) {
    const header = req.headers?.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) {
        res.status(401).json({ error: 'login_required' });
        return null;
    }
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) {
        res.status(503).json({ error: 'auth_unavailable' });
        return null;
    }
    try {
        const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
        const { data, error } = await client.auth.getUser(token);
        if (error || !data?.user) {
            res.status(401).json({ error: 'login_required' });
            return null;
        }
        return data.user;
    } catch {
        res.status(503).json({ error: 'auth_unavailable' });
        return null;
    }
}
