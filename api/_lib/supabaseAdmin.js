import { createClient } from '@supabase/supabase-js';

let client;

/**
 * service_role 클라이언트. 캐시 테이블(ai_recommendation_cache, place_cache)은
 * RLS로 쓰기를 전부 막아두고 서버만 service_role로 쓴다 — anon 키로 폴백하지
 * 않는다(폴백하면 누구나 캐시를 오염시킬 수 있는 정책이 필요해진다).
 * 키가 없으면 null을 돌려주고 호출부는 캐시 없이 동작한다.
 */
export function supabaseAdmin() {
    if (client !== undefined) return client;
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    client = url && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false } }) : null;
    return client;
}
