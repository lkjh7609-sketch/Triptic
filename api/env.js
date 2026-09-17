// Vercel 환경 변수를 브라우저에 주입하는 API 엔드포인트
// /api/env.js

export default function handler(req, res) {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 클라이언트에 노출해도 안전한 환경 변수만 전달
    const env = {
        SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
        SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
        GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '',
        AVIATIONSTACK_API_KEY: process.env.NEXT_PUBLIC_AVIATIONSTACK_API_KEY || process.env.AVIATIONSTACK_API_KEY || '',
        GEMINI_API_KEY_EXISTS: !!process.env.GEMINI_API_KEY // 키 존재 여부만 전달
    };

    res.status(200).json(env);
}
