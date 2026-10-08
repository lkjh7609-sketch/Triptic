// 항공 운임 검색 — Ignav (https://ignav.com/docs). 요청 만들기·응답을 앱 카드 모양으로 줄이기
// 키(IGNAV_API_KEY)는 서버 환경변수로만. 가격은 승객 전체 합계다.
// 2026-10-09 실측: Ignav의 **왕복 검색은 처음 부르면 20~29초**(같은 검색은 1~2초, 직항만 걸어도 20초), **편도는 4~5초**다.
// 그래서 왕복은 가는 편·오는 편 편도 2개를 동시에 불러(약 5초) 우리가 짝짓는다(pairOneWays). 짝 가격은 편도 합이라
// 왕복 검색가와 88%는 같고 나머지는 왕복가가 최대 14%(같은 항공사 왕복 할인) 싸다 — 최저가 조합은 같았다.
// 노선당 최대 1,300건·1.5MB가 와서 가격순+항공사별로 추려 내려준다.

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

/** 편도 한 구간 요청 본문 — 'back'은 출발·도착을 바꾸고 날짜를 귀국일로 */
export function buildOneWayBody(search, locale, direction = 'out') {
    const body = buildIgnavBody({ ...search, returnDate: null }, locale);
    if (direction === 'back') {
        body.origin = search.destination;
        body.destination = search.origin;
        body.departure_date = search.returnDate;
    }
    return body;
}

async function post(path, body) {
    const res = await fetch(BASE + path, {
        method: 'POST',
        headers: { 'X-Api-Key': process.env.IGNAV_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

/** 가는 편 × 오는 편을 왕복 항목으로 — 같은 날 왕복이면 오는 편이 가는 편 도착 뒤에 떠나는 조합만 */
export function pairOneWays(out, back) {
    const outs = Array.isArray(out?.itineraries) ? out.itineraries : [];
    const backs = Array.isArray(back?.itineraries) ? back.itineraries : [];
    const arrives = (it) => it.outbound?.segments?.at(-1)?.arrival_time_utc ?? '';
    const departs = (it) => it.outbound?.segments?.[0]?.departure_time_utc ?? '';
    const pairs = [];
    for (const a of outs) {
        for (const b of backs) {
            if (typeof a?.price?.amount !== 'number' || typeof b?.price?.amount !== 'number') continue;
            if (arrives(a) && departs(b) && departs(b) <= arrives(a)) continue;
            pairs.push({
                price: { amount: a.price.amount + b.price.amount, currency: a.price.currency, status: a.price.status === 'verified' && b.price.status === 'verified' ? 'verified' : 'unverified' },
                outbound: a.outbound,
                inbound: b.outbound,
                cabin_class: a.cabin_class,
                requires_self_transfer: Boolean(a.requires_self_transfer || b.requires_self_transfer),
                ignav_id: `${a.ignav_id}.${b.ignav_id}`,
            });
        }
    }
    return { itineraries: pairs, observed_at: out?.observed_at ?? null };
}

/** 검색 실행 — 편도는 1번, 왕복은 편도 2번을 동시에(호출 수는 callsFor(search)) */
export async function ignavSearch(search, locale) {
    if (!search.returnDate) return post('/api/fares/one-way', buildOneWayBody(search, locale));
    const [out, back] = await Promise.all([
        post('/api/fares/one-way', buildOneWayBody(search, locale, 'out')),
        post('/api/fares/one-way', buildOneWayBody(search, locale, 'back')),
    ]);
    return pairOneWays(out, back);
}

/** 이 검색이 Ignav를 몇 번 부르나(월 상한에 센다) */
export const callsFor = (search) => (search.returnDate ? 2 : 1);

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
 * 가격이 없거나 구간이 비면 뺀다. 확인된 가격이 있으면 미확인 가격은 뺀다(아래).
 */
export function normalizeIgnav(raw, search) {
    const payers = Math.max(1, search.adults + (search.children ?? 0));
    const priced = (Array.isArray(raw?.itineraries) ? raw.itineraries : [])
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

    // 2026-10-09 실측: 미확인('unverified') 가격은 비현실적으로 낮다(영어 시장 ICN→TYO 왕복 2인 $202 vs 확인된 최저 $391).
    // 확인된 가격이 하나라도 있으면 미확인은 빼고, 하나도 없을 때만 '약'으로 보여 준다
    const hasVerified = priced.some((o) => o.verified);
    const all = hasVerified ? priced.filter((o) => o.verified) : priced;

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
