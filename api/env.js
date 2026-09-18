// Vercel 환경 변수를 브라우저에 주입하는 API 엔드포인트
// /api/env.js

const ALLOWED_ORIGINS = new Set([
    'https://triptic-ten.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
]);

export default function handler(req, res) {
    // CORS 헤더 설정 — Origin이 허용 목록에 있을 때만 명시적으로 반사한다.
    // Origin 헤더가 없는 요청(네이티브 앱 WebView 등)은 그대로 통과시킨다.
    const origin = req.headers.origin;
    if (!origin || ALLOWED_ORIGINS.has(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
        res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 클라이언트에 노출해도 안전한 환경 변수만 전달.
    // AVIATIONSTACK_API_KEY는 여기 포함하지 않는다 — 리퍼러 제한 등 별도 보호
    // 수단이 없는 키이므로 서버에만 두고 /api/flight를 통해서만 사용한다.
    const env = {
        SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
        SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
        GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '',
        GEMINI_API_KEY_EXISTS: !!process.env.GEMINI_API_KEY // 키 존재 여부만 전달
    };

    res.status(200).json(env);
}
