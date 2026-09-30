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

/** 좌석 등급 — 랜딩 URL API의 cabinClass 값 */
export const CABINS = ['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'];

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
 * 출발일은 오늘(시차 하루 여유)부터 1년 안, 귀국일은 출발일 이후, 성인 1명 이상·성인+아동 9명 이하·유아는 성인 수까지.
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
    const count = (value, fallback) => (value == null || value === '' ? fallback : Number(value));
    const adults = count(query.adults, 1);
    const children = count(query.children, 0);
    const infants = count(query.infants, 0);
    if (![adults, children, infants].every(Number.isInteger)) return null;
    // 항공 예약 한 번에 좌석 9석(성인+아동), 유아(좌석 없음)는 성인 1명당 1명
    if (adults < 1 || children < 0 || infants < 0 || adults + children > 9 || infants > adults) return null;
    const kind = (value) => (value === 'airport' ? 'airport' : 'city');
    // 좌석 등급 — 안 주면(또는 모르는 값이면) 지정하지 않는다(마이리얼트립 기본값)
    const cabin = CABINS.includes(query.cabin) ? query.cabin : null;
    return {
        origin,
        originType: kind(query.origin_type),
        destination,
        destinationType: kind(query.destination_type),
        departDate,
        returnDate,
        adults,
        children,
        infants,
        ...(cabin ? { cabin } : {}),
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
    const params = new URLSearchParams({ trip: legs.join('/'), adult: String(flight.adults) });
    // 결과 페이지는 child·infant를 읽는다(승객 수 표시로 확인)
    if (flight.children) params.set('child', String(flight.children));
    if (flight.infants) params.set('infant', String(flight.infants));
    params.set('tripType', flight.returnDate ? 'ROUND_TRIP' : 'ONE_WAY');
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
                    child: flight.children ?? 0,
                    infant: flight.infants ?? 0,
                    ...(flight.cabin ? { cabinClass: flight.cabin } : {}),
                },
            });
            if (isMyrealtripUrl(json.data)) return json.data;
        } catch (e) {
            console.warn('[myrealtrip] landing url failed:', e instanceof Error ? e.message : e);
        }
    }
    return airWebResultsUrl(flight);
}

// ── 항공 특가(출발지별 최저가) ───────────────────────────────────────────

/**
 * 특가 카드에 올리는 도착지(인기 노선). 마이리얼트립 최저가 조회는 도착 공항 코드를 받고(최대 50개),
 * 이름은 응답에 없어서 여기서 정한다. 응답에 없는 노선은 그냥 빠진다.
 * theme: 아래 테마 카드(일본 단거리 japan · 아시아 휴양 sea · 유럽/미주/호주 장거리 far)에 묶이는 그룹.
 */
export const DEAL_DESTINATIONS = [
    { code: 'KIX', city: '오사카', airport: '간사이 국제공항', theme: 'japan' },
    { code: 'NRT', city: '도쿄', airport: '나리타 국제공항', theme: 'japan' },
    { code: 'FUK', city: '후쿠오카', airport: '후쿠오카 공항', theme: 'japan' },
    { code: 'NGO', city: '나고야', airport: '주부 국제공항', theme: 'japan' },
    { code: 'CTS', city: '삿포로', airport: '신치토세 공항', theme: 'japan' },
    { code: 'OKA', city: '오키나와', airport: '나하 공항', theme: 'japan' },
    { code: 'BKK', city: '방콕', airport: '수완나품 국제공항', theme: 'sea' },
    { code: 'DAD', city: '다낭', airport: '다낭 국제공항', theme: 'sea' },
    { code: 'CXR', city: '나트랑', airport: '캄란 국제공항', theme: 'sea' },
    { code: 'PQC', city: '푸꾸옥', airport: '푸꾸옥 국제공항', theme: 'sea' },
    { code: 'SGN', city: '호치민', airport: '떤선녓 국제공항', theme: 'sea' },
    { code: 'HAN', city: '하노이', airport: '노이바이 국제공항', theme: 'sea' },
    { code: 'CEB', city: '세부', airport: '막탄세부 국제공항', theme: 'sea' },
    { code: 'BKI', city: '코타키나발루', airport: '코타키나발루 국제공항', theme: 'sea' },
    { code: 'DPS', city: '발리', airport: '응우라라이 국제공항', theme: 'sea' },
    { code: 'SIN', city: '싱가포르', airport: '창이 공항', theme: 'sea' },
    { code: 'TPE', city: '타이베이', airport: '타오위안 국제공항', theme: 'sea' },
    { code: 'HKG', city: '홍콩', airport: '홍콩 국제공항', theme: 'sea' },
    { code: 'GUM', city: '괌', airport: '앙토니오 B. 원 팟 국제공항', theme: 'sea' },
    { code: 'CDG', city: '파리', airport: '샤를 드 골 공항', theme: 'far' },
    { code: 'LHR', city: '런던', airport: '히스로 공항', theme: 'far' },
    { code: 'FCO', city: '로마', airport: '피우미치노 공항', theme: 'far' },
    { code: 'BCN', city: '바르셀로나', airport: '엘프라트 공항', theme: 'far' },
    { code: 'JFK', city: '뉴욕', airport: '존 F. 케네디 국제공항', theme: 'far' },
    { code: 'LAX', city: '로스앤젤레스', airport: '로스앤젤레스 국제공항', theme: 'far' },
    { code: 'SYD', city: '시드니', airport: '시드니 공항', theme: 'far' },
];

// 전체 목적지 조회는 도시 코드로 올 수 있어서(오사카 OSA 등) 공항 코드로 되돌린다
const DEAL_ALIASES = { OSA: 'KIX', TYO: 'NRT', SPK: 'CTS', PAR: 'CDG', LON: 'LHR', ROM: 'FCO', NYC: 'JFK' };

const AIRLINE_NAMES = {
    KE: '대한항공', OZ: '아시아나항공', '7C': '제주항공', LJ: '진에어', TW: '티웨이항공', BX: '에어부산', ZE: '이스타항공',
    RS: '에어서울', YP: '에어프레미아', RF: '에어로케이', JL: '일본항공', NH: '전일본공수', MM: '피치', GK: '젯스타재팬',
    TG: '타이항공', VN: '베트남항공', VJ: '비엣젯', QH: '뱀부항공', PR: '필리핀항공', '5J': '세부퍼시픽', SQ: '싱가포르항공',
    CX: '캐세이퍼시픽', BR: '에바항공', CI: '중화항공', AF: '에어프랑스', BA: '영국항공', LH: '루프트한자', AZ: 'ITA 항공',
    DL: '델타항공', UA: '유나이티드항공', AA: '아메리칸항공', QF: '콴타스항공', KL: 'KLM', TR: '스쿠트',
};

export function airlineName(code) {
    return typeof code === 'string' && code ? (AIRLINE_NAMES[code] ?? code) : null;
}

/** 최저가 조회 한 행 → 특가 카드. 이름을 아는 도착지·유효한 가격과 날짜만 */
export function normalizeDeal(row, averages = new Map()) {
    const dest = DEAL_DESTINATIONS.find((d) => d.code === row?.toCity);
    const price = num(row?.totalPrice);
    if (!dest || price === null || price <= 0 || !isValidYmd(row.departureDate) || !isValidYmd(row.returnDate)) return null;
    const average = averages.get(dest.code) ?? null;
    // 평균보다 5% 이상 싼 것만 "할인"으로 — 비슷한 값은 숫자를 붙이지 않는다
    const discountPct = average && average > price ? Math.round((1 - price / average) * 100) : null;
    return {
        code: dest.code,
        city: dest.city,
        airport: dest.airport,
        theme: dest.theme,
        price,
        currency: 'KRW',
        departDate: row.departureDate,
        returnDate: row.returnDate,
        airline: str(row.airline),
        airlineName: airlineName(row.airline),
        average,
        discountPct: discountPct !== null && discountPct >= 5 ? discountPct : null,
    };
}

/**
 * 출발지(기본 인천)에서 인기 노선의 최저가 — 노선마다 가장 싼 출발일 하나.
 * 최저가는 실시간이 아니라 마이리얼트립이 운임 검색 때 모아 둔 값이다(화면에 그렇게 밝힌다).
 * 평균가(전체 목적지 조회)는 있으면 "평균 대비 n%"에 쓰고, 그 호출이 실패해도 특가는 보여준다.
 */
export async function searchFlightDeals(origin = 'ICN', period = 5) {
    const [lowest, bulk] = await Promise.allSettled([
        call('POST', '/v1/products/flight/calendar/lowest', {
            body: { depCityCd: origin, arrCityCds: DEAL_DESTINATIONS.map((d) => d.code), period },
        }),
        call('POST', '/v1/products/flight/calendar/bulk-lowest', { body: { depCityCd: origin, period } }),
    ]);
    if (lowest.status !== 'fulfilled') throw lowest.reason;
    const averages = new Map();
    if (bulk.status === 'fulfilled' && Array.isArray(bulk.value.data)) {
        for (const row of bulk.value.data) {
            const code = DEAL_ALIASES[row?.toCity] ?? row?.toCity;
            const avg = num(row?.averagePrice);
            if (avg && !averages.has(code)) averages.set(code, avg);
        }
    } else if (bulk.status === 'rejected') {
        console.warn('[myrealtrip] bulk-lowest failed:', bulk.reason instanceof Error ? bulk.reason.message : bulk.reason);
    }
    const rows = Array.isArray(lowest.value.data) ? lowest.value.data : [];
    return rows
        .map((row) => normalizeDeal({ ...row, toCity: DEAL_ALIASES[row?.toCity] ?? row?.toCity }, averages))
        .filter(Boolean)
        // 많이 싼 순(평균 대비), 평균을 모르는 것은 뒤로 가격순
        .sort((a, b) => (b.discountPct ?? -1) - (a.discountPct ?? -1) || a.price - b.price);
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

// 유심·eSIM·포켓와이파이 상품(카테고리 "유심·와이파이" 등) — 도시 이름 + "유심"으로 찾으면 대부분 이것만
// 오지만, 가끔 섞이는 다른 상품(차량 대여 등)은 뺀다
const SIM_PATTERN = /유심|와이파이|이심|e-?sim|usim|wi-?fi/i;

export function isSimProduct(product) {
    return SIM_PATTERN.test(product.category ?? '') || SIM_PATTERN.test(product.title);
}

/** 그 도시(나라)에서 쓸 유심·eSIM 상품 */
export async function searchSimProducts(city, size) {
    const items = await searchProducts(`${city} 유심`, Math.min(size * 2, 20));
    return items.filter(isSimProduct).slice(0, size);
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
