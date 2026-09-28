// 마이리얼트립 파트너 API (https://docs.myrealtrip.com)
// 키(MYREALTRIP_API_KEY)는 서버 환경변수로만 — 앱에는 절대 내려보내지 않는다.
// 이 API는 잘못된 요청에도 HTTP 200을 주고 result.status/result.code로 실패를 알린다.

const BASE = 'https://partner-ext-api.myrealtrip.com';
const TIMEOUT_MS = 8000;

export function isConfigured() {
    return Boolean(process.env.MYREALTRIP_API_KEY);
}

async function call(method, path, { query, body } = {}) {
    const url = new URL(path, BASE);
    for (const [key, value] of Object.entries(query ?? {})) {
        if (value != null) url.searchParams.set(key, String(value));
    }
    const res = await fetch(url, {
        method,
        headers: {
            Authorization: `Bearer ${process.env.MYREALTRIP_API_KEY}`,
            ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    let json = null;
    try {
        json = await res.json();
    } catch {
        // 본문이 JSON이 아니면 아래에서 실패로 처리
    }
    if (!res.ok || json?.result?.code !== 'success') {
        throw new Error(`myrealtrip ${path}: ${json?.result?.status ?? res.status} ${json?.result?.message ?? ''}`.trim());
    }
    return json;
}

// ── 링크 ────────────────────────────────────────────────────────────────

/** 마이리얼트립 통합 검색 결과(키워드는 q — keyword/query는 무시된다) */
export function searchUrl(keyword) {
    return `https://www.myrealtrip.com/search?q=${encodeURIComponent(keyword)}`;
}

/** 마이링크로 만들 수 있는 주소 — 마이리얼트립 도메인의 https 주소만, 2000자 이하(API 제한) */
export function isMyrealtripUrl(raw) {
    if (typeof raw !== 'string' || raw.length > 2000) return false;
    try {
        const u = new URL(raw);
        return u.protocol === 'https:' && (u.hostname === 'myrealtrip.com' || u.hostname.endsWith('.myrealtrip.com'));
    } catch {
        return false;
    }
}

/** 투어·티켓 상품 상세 주소(상품 카드가 넘기는 것) — 공개 엔드포인트가 아무 페이지나 마이링크로 만들지 않게 */
const PRODUCT_URL = /^https:\/\/experiences\.myrealtrip\.com\/products\/\d+(\?[^#]*)?$/;

export function isProductUrl(raw) {
    return isMyrealtripUrl(raw) && PRODUCT_URL.test(raw);
}

/**
 * 마이링크(제휴 추적 단축 링크) 생성. 마이링크마다 ID가 달라서, 수익·예약 내역의 linkId로
 * 어느 링크(어디서 누른 것)에서 난 예약인지 되짚을 수 있다(partner_links.external_id).
 */
export async function createMylink(targetUrl) {
    const json = await call('POST', '/v1/mylink', { body: { targetUrl } });
    const mylink = json.data?.mylink;
    if (typeof mylink !== 'string' || !mylink.startsWith('https://')) throw new Error('myrealtrip mylink: no link');
    const id = json.data?.mylinkId;
    return { partnerUrl: mylink, externalId: id != null ? String(id) : null };
}

// ── 항공 ────────────────────────────────────────────────────────────────

const IATA = /^[A-Z]{3}$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

function isValidYmd(value) {
    if (typeof value !== 'string' || !YMD.test(value)) return false;
    const d = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function addDays(ymd, days) {
    const d = new Date(`${ymd}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

/** 한국 날짜(마이리얼트립 요청 날짜는 KST 기준) */
export function kstToday(now = new Date()) {
    return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

/**
 * 항공 검색 요청 검증 — 공개 엔드포인트라 키를 쓰는 호출 전에 걸러낸다.
 * 출발일은 오늘(시차 하루 여유)부터 1년 안, 귀국일은 출발일 이후, 성인 1~9명.
 * 코드 종류(city/airport)는 마이리얼트립 주소의 C./A. 접두어에 쓴다.
 */
export function parseFlightQuery(query, today = kstToday()) {
    const origin = typeof query.origin === 'string' ? query.origin.toUpperCase() : '';
    const destination = typeof query.destination === 'string' ? query.destination.toUpperCase() : '';
    if (!IATA.test(origin) || !IATA.test(destination) || origin === destination) return null;
    const departDate = query.depart_date;
    if (!isValidYmd(departDate) || departDate < addDays(today, -1) || departDate > addDays(today, 366)) return null;
    const returnDate = query.return_date ? query.return_date : null;
    if (returnDate !== null && (!isValidYmd(returnDate) || returnDate < departDate || returnDate > addDays(today, 400))) return null;
    const adults = query.adults == null || query.adults === '' ? 1 : Number(query.adults);
    if (!Number.isInteger(adults) || adults < 1 || adults > 9) return null;
    const kind = (value) => (value === 'airport' ? 'airport' : 'city');
    return {
        origin,
        originType: kind(query.origin_type),
        destination,
        destinationType: kind(query.destination_type),
        departDate,
        returnDate,
        adults,
    };
}

/**
 * 랜딩 URL API가 돌려주는 항공 검색 결과 주소를 직접 만든다(API 실패·키 없음 대비).
 * 예) C.SEL.C.OSA.2026-11-10/C.OSA.C.SEL.2026-11-15 — C는 도시 코드, A는 공항 코드
 */
export function airWebResultsUrl(flight) {
    const place = (code, type) => `${type === 'airport' ? 'A' : 'C'}.${code}`;
    const from = place(flight.origin, flight.originType);
    const to = place(flight.destination, flight.destinationType);
    const legs = [`${from}.${to}.${flight.departDate}`];
    if (flight.returnDate) legs.push(`${to}.${from}.${flight.returnDate}`);
    const params = new URLSearchParams({
        trip: legs.join('/'),
        adult: String(flight.adults),
        tripType: flight.returnDate ? 'ROUND_TRIP' : 'ONE_WAY',
    });
    return `https://air-web.myrealtrip.com/results?${params.toString()}`;
}

/** 항공 검색 결과 주소 — 문서대로 랜딩 URL API를 먼저 쓰고, 실패하면 같은 모양으로 직접 만든다 */
export async function flightLandingUrl(flight) {
    if (isConfigured()) {
        try {
            const json = await call('POST', '/v1/products/flight/fare-query-landing-url', {
                body: {
                    depAirportCd: flight.origin,
                    arrAirportCd: flight.destination,
                    tripTypeCd: flight.returnDate ? 'RT' : 'OW',
                    depDate: flight.departDate,
                    ...(flight.returnDate ? { arrDate: flight.returnDate } : {}),
                    adult: flight.adults,
                },
            });
            if (isMyrealtripUrl(json.data)) return json.data;
        } catch (e) {
            console.warn('[myrealtrip] landing url failed:', e instanceof Error ? e.message : e);
        }
    }
    return airWebResultsUrl(flight);
}

// ── 투어·티켓 상품 ─────────────────────────────────────────────────────

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v) => (typeof v === 'string' && v ? v : null);

/** 검색 결과 한 개 → 앱 카드 모양. 상품 주소·이름이 없으면 버린다 */
export function normalizeProduct(item) {
    if (!item || !isProductUrl(item.productUrl) || !str(item.itemName)) return null;
    const image = str(item.imageUrl);
    return {
        id: String(item.gid ?? item.productUrl),
        title: item.itemName,
        category: str(item.category),
        imageUrl: image && image.startsWith('https://') ? image : null,
        price: num(item.salePrice),
        currency: 'KRW',
        rating: num(item.reviewScore),
        reviewCount: num(item.reviewCount),
        url: item.productUrl,
    };
}

export async function searchProducts(keyword, size) {
    const json = await call('POST', '/v1/products/tna/search', { body: { keyword, page: 1, size } });
    const items = Array.isArray(json.data?.items) ? json.data.items : [];
    return items.map(normalizeProduct).filter(Boolean);
}

// ── 판매(예약·수익) ─────────────────────────────────────────────────────

/** [from, to](양끝 포함)를 maxDays일 이하 구간으로 — 조회 기간 제한(항공 예약 1개월 등) 대응 */
export function splitRange(from, to, maxDays) {
    const out = [];
    let start = from;
    while (start <= to) {
        const end = addDays(start, maxDays - 1) < to ? addDays(start, maxDays - 1) : to;
        out.push([start, end]);
        start = addDays(end, 1);
    }
    return out;
}

/**
 * 수익 행 → 판매 탭 공통 모양. 환불은 closingType이 붙고 commission이 음수로 온다.
 * 정산 대상 금액(commissionBase)은 2026-04 이전 예약엔 null이라 판매가로 대신한다.
 */
export function normalizeRevenue(row, kind) {
    return {
        kind,
        reservationNo: str(row.reservationNo) ?? str(row.flightReservationNo),
        linkId: row.linkId != null ? String(row.linkId) : null,
        title: str(row.productTitle),
        closingType: str(row.closingType),
        amount: num(row.commissionBase) ?? num(row.salePrice),
        commission: num(row.commission) ?? 0,
        commissionRate: num(row.commissionRate),
        date: str(row.settlementCriteriaDate),
        reservedAt: str(row.reservedAt),
    };
}

/** 예약 행(투어·숙소 등 / 항공) → 판매 탭 공통 모양. 시각은 UTC(Kst 접미사 필드만 한국 시각) */
export function normalizeReservation(row, kind) {
    return {
        kind,
        reservationNo: str(row.reservationNo),
        linkId: row.linkId != null ? String(row.linkId) : null,
        title: kind === 'flight' ? str(row.airlineName) ?? str(row.airline) : str(row.productTitle),
        category: str(row.productCategory) ?? str(row.categoryCode),
        status: str(row.status),
        statusLabel: str(row.statusKor),
        amount: kind === 'flight' ? num(row.issueNet) : num(row.commissionBase) ?? num(row.salePrice),
        quantity: num(row.quantity),
        city: str(row.city),
        reservedAt: str(row.reservedAt),
        canceledAt: str(row.canceledAt) ?? str(row.cancelledAt),
    };
}

const RESERVATION_PAGE_SIZE = 300;
const RESERVATION_MAX_PAGES = 10;

async function listReservations(from, to) {
    const rows = [];
    for (let page = 1; page <= RESERVATION_MAX_PAGES; page += 1) {
        const json = await call('GET', '/v1/reservations', {
            query: { dateSearchType: 'RESERVATION_DATE', startDate: from, endDate: to, page, pageSize: RESERVATION_PAGE_SIZE },
        });
        const data = Array.isArray(json.data) ? json.data : [];
        rows.push(...data);
        const total = json.meta?.totalCount;
        if (data.length < RESERVATION_PAGE_SIZE || (typeof total === 'number' && rows.length >= total)) break;
    }
    return rows.map((r) => normalizeReservation(r, 'tna'));
}

// 항공 예약·항공 수익은 한 번에 최대 1개월 — 28일씩 나눠 동시에 부른다
const FLIGHT_MAX_DAYS = 28;

async function listFlightReservations(from, to) {
    const chunks = await Promise.all(
        splitRange(from, to, FLIGHT_MAX_DAYS).map(([start, end]) =>
            call('GET', '/v1/reservations/flight', { query: { dateSearchType: 'RESERVATION_DATE', startDate: start, endDate: end } }),
        ),
    );
    return chunks.flatMap((json) => (Array.isArray(json.data) ? json.data : [])).map((r) => normalizeReservation(r, 'flight'));
}

async function listRevenues(path, kind, from, to, basis, maxDays) {
    const dateSearchType = basis === 'settlement' ? 'SETTLEMENT' : 'PAYMENT';
    const chunks = await Promise.all(
        splitRange(from, to, maxDays).map(([start, end]) => call('GET', path, { query: { dateSearchType, startDate: start, endDate: end } })),
    );
    return chunks.flatMap((json) => (Array.isArray(json.data) ? json.data : [])).map((r) => normalizeRevenue(r, kind));
}

/**
 * 기간(KST, 최대 180일) 예약·수익. 한 쪽이 실패해도 나머지는 보여주도록 부분 실패를 모은다.
 * 수익은 매일 오전 6시에 전날까지 정산된다.
 */
export async function fetchSales(from, to, basis) {
    const parts = await Promise.allSettled([
        listReservations(from, to),
        listFlightReservations(from, to),
        // 비항공 수익은 최대 6개월 — 판매 탭 기간(최대 180일)이면 한 번에
        listRevenues('/v1/revenues', 'tna', from, to, basis, 180),
        listRevenues('/v1/revenues/flight', 'flight', from, to, basis, FLIGHT_MAX_DAYS),
    ]);
    const failed = [];
    const value = (i, name) => {
        if (parts[i].status === 'fulfilled') return parts[i].value;
        console.warn(`[myrealtrip] ${name} failed:`, parts[i].reason instanceof Error ? parts[i].reason.message : parts[i].reason);
        failed.push(name);
        return [];
    };
    const reservations = [...value(0, 'reservations'), ...value(1, 'flightReservations')];
    const revenues = [...value(2, 'revenues'), ...value(3, 'flightRevenues')];
    return { reservations, revenues, failed };
}
