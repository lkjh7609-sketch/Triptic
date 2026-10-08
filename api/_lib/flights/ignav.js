// 항공 운임 검색 — Ignav (https://ignav.com/docs). 요청 만들기·응답을 앱 카드 모양으로 줄이기
// 키(IGNAV_API_KEY)는 서버 환경변수로만. 2026-10-09 실측: 처음 부르면 6~29초 걸리고(같은 검색은 1~2초),
// 노선당 최대 1,300건·1.5MB가 와서 가격순+항공사별로 추려 내려준다. 가격은 승객 전체 합계다.

const BASE = 'https://ignav.com';
// Vercel 함수 한도(vercel.json partnerProducts maxDuration 30초)보다 조금 짧게
const TIMEOUT_MS = 27_000;

/** 화면 언어 → Ignav market(가격 통화·지역). 한국어 KRW, 영어 USD, 일본어 JPY, 번체 TWD */
export const MARKET_BY_LOCALE = { ko: 'KR', en: 'US', ja: 'JP', 'zh-TW': 'TW' };

const CABIN = { ECONOMY: 'economy', PREMIUM_ECONOMY: 'premium_economy', BUSINESS: 'business', FIRST: 'first' };

/** 돌려주는 카드 수 — 가격순 앞쪽 + 항공사마다 싼 것 몇 개(정렬·항공사 필터가 의미 있도록) */
const MAX_OFFERS = 100;
const CHEAPEST_OVERALL = 60;
const PER_CARRIER = 4;

export function isConfigured() {
    return Boolean(process.env.IGNAV_API_KEY);
}

/** 검증된 검색 조건(myrealtrip.parseFlightQuery) → Ignav 요청 본문. 유아는 좌석 없는(무릎) 유아로 보낸다 */
export function buildIgnavBody(search, locale) {
    const body = {
        origin: search.origin,
        destination: search.destination,
        departure_date: search.departDate,
        adults: search.adults,
        market: MARKET_BY_LOCALE[locale] ?? 'KR',
        cabin_class: CABIN[search.cabin] ?? 'economy',
    };
    if (search.children) body.children = search.children;
    if (search.infants) body.infants_on_lap = search.infants;
    if (search.returnDate) body.return_date = search.returnDate;
    return body;
}

export async function ignavSearch(search, locale) {
    const path = search.returnDate ? '/api/fares/round-trip' : '/api/fares/one-way';
    const res = await fetch(BASE + path, {
        method: 'POST',
        headers: { 'X-Api-Key': process.env.IGNAV_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(buildIgnavBody(search, locale)),
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    let json = null;
    try {
        json = await res.json();
    } catch {
        // 본문이 JSON이 아니면 아래에서 실패로 처리
    }
    if (!res.ok) throw new Error(`ignav ${path}: ${res.status} ${json?.error?.code ?? ''}`.trim());
    return json;
}

function normalizeLeg(leg) {
    const segs = Array.isArray(leg?.segments) ? leg.segments : [];
    if (segs.length === 0) return null;
    const first = segs[0];
    const last = segs[segs.length - 1];
    return {
        carrier: { code: first.marketing_carrier_code, name: first.operating_carrier_name || leg.carrier || first.marketing_carrier_code },
        depart: first.departure_time_local,
        arrive: last.arrival_time_local,
        origin: first.departure_airport,
        destination: last.arrival_airport,
        minutes: leg.duration_minutes,
        stops: segs.length - 1,
        via: segs.slice(0, -1).map((s) => s.arrival_airport),
        segments: segs.map((s) => ({
            carrier: s.marketing_carrier_code,
            flightNo: `${s.marketing_carrier_code}${s.flight_number}`,
            origin: s.departure_airport,
            destination: s.arrival_airport,
            depart: s.departure_time_local,
            arrive: s.arrival_time_local,
            minutes: s.duration_minutes,
        })),
    };
}

/** 같은 비행 조합(편명·출발 시각)이면 가장 싼 것만 */
function dedupe(offers) {
    const seen = new Set();
    return offers.filter((o) => {
        const key = o.legs.map((l) => l.segments.map((s) => `${s.flightNo}@${s.depart}`).join('+')).join('|');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * Ignav 응답 → { currency, offers[] }. 가격(price)은 승객 전체 합계, perPerson은 (성인+아동) 한 명 몫 근사.
 * 가격이 없거나 구간이 비면 뺀다.
 */
export function normalizeIgnav(raw, search) {
    const payers = Math.max(1, search.adults + (search.children ?? 0));
    const all = (Array.isArray(raw?.itineraries) ? raw.itineraries : [])
        .map((it) => {
            const amount = it?.price?.amount;
            if (typeof amount !== 'number' || !(amount > 0)) return null;
            const legs = [normalizeLeg(it.outbound), ...(it.inbound ? [normalizeLeg(it.inbound)] : [])];
            if (legs.some((l) => l === null)) return null;
            return {
                id: String(it.ignav_id ?? ''),
                price: amount,
                perPerson: Math.round(amount / payers),
                currency: it.price.currency,
                verified: it.price.status === 'verified',
                selfTransfer: Boolean(it.requires_self_transfer),
                legs,
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.price - b.price);

    const picked = new Set(all.slice(0, CHEAPEST_OVERALL));
    const perCarrier = new Map();
    for (const o of all) {
        const code = o.legs[0].carrier.code;
        const n = perCarrier.get(code) ?? 0;
        if (n < PER_CARRIER) {
            picked.add(o);
            perCarrier.set(code, n + 1);
        }
    }
    const offers = dedupe(all.filter((o) => picked.has(o))).slice(0, MAX_OFFERS);
    return { currency: offers[0]?.currency ?? null, offers, observedAt: typeof raw?.observed_at === 'string' ? raw.observed_at : null };
}
