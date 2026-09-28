// Vercel Serverless Function: 관리자 판매 탭 — 제휴사별 예약 내역·수익 현황
// Endpoint: GET /api/adminSales?from=2026-09-01&to=2026-09-28&basis=payment|settlement
//           Authorization: Bearer <Supabase access token>
//
// 관리자 확인은 서버가 직접 한다: 토큰으로 사용자를 확인하고 profiles.role='admin'이 아니면 403.
// 제휴사 목록은 api/_lib/affiliates 레지스트리(SALES_PROVIDERS) — 판매 API를 아직 안 붙인 곳은
// "연동 전"으로만 보이고 숫자를 만들어 내지 않는다.
import { applyCors, createRateLimiter } from './_lib/http.js';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { SALES_PROVIDERS } from './_lib/affiliates/index.js';
import { addDays, kstToday } from './_lib/affiliates/myrealtrip.js';

const isRateLimited = createRateLimiter(20);
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 180;

async function requireAdmin(req, db) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return null;
    const { data, error } = await db.auth.getUser(token);
    if (error || !data?.user) return null;
    const { data: profile } = await db.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
    return profile?.role === 'admin' ? data.user : null;
}

/** linkId(마이링크 ID) → 어디서 누른 링크였는지(partner_links.sub_id) */
async function placementsFor(db, brand, rows) {
    const ids = [...new Set(rows.map((r) => r.linkId).filter(Boolean))];
    if (ids.length === 0) return {};
    const { data, error } = await db.from('partner_links').select('external_id, sub_id').eq('brand', brand).in('external_id', ids);
    if (error) {
        console.warn('[adminSales] placement lookup failed:', error.message);
        return {};
    }
    return Object.fromEntries((data ?? []).map((r) => [r.external_id, r.sub_id]));
}

export default async function handler(req, res) {
    applyCors(req, res, 'GET,OPTIONS', 'Content-Type, Authorization');
    res.setHeader('Cache-Control', 'private, no-store');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
    if (isRateLimited(req)) return res.status(429).json({ error: 'rate_limited' });

    const db = supabaseAdmin();
    if (!db) return res.status(503).json({ error: 'server_unavailable' });
    const admin = await requireAdmin(req, db);
    if (!admin) return res.status(403).json({ error: 'forbidden' });

    const { from, to } = req.query ?? {};
    const basis = req.query?.basis === 'settlement' ? 'settlement' : 'payment';
    const today = kstToday();
    if (!YMD.test(from ?? '') || !YMD.test(to ?? '') || from > to || to > addDays(today, 1) || addDays(from, MAX_DAYS - 1) < to) {
        return res.status(400).json({ error: 'invalid_range' });
    }

    const providers = await Promise.all(
        SALES_PROVIDERS.map(async (p) => {
            const base = { id: p.id, name: p.name, dashboardUrl: p.dashboardUrl };
            if (!p.fetchSales) return { ...base, status: 'not_integrated' };
            if (!p.isConfigured()) return { ...base, status: 'not_configured' };
            try {
                const { reservations, revenues, failed } = await p.fetchSales(from, to, basis);
                const placements = await placementsFor(db, p.id, [...reservations, ...revenues]);
                const withPlacement = (r) => ({ ...r, placement: (r.linkId && placements[r.linkId]) || null });
                return {
                    ...base,
                    status: failed.length === 4 ? 'error' : 'ok',
                    failed,
                    reservations: reservations.map(withPlacement),
                    revenues: revenues.map(withPlacement),
                };
            } catch (e) {
                console.warn(`[adminSales] ${p.id} failed:`, e instanceof Error ? e.message : e);
                return { ...base, status: 'error' };
            }
        }),
    );
    return res.status(200).json({ from, to, basis, providers });
}
