// Kayak 호텔 검색(호텔스컴바인 포함) — 요청 검증·응답 줄이기
// 문서: https://developers.kayak.com/hotels-search-api (GET /api/3.0/hotels — onlyIfComplete=true면 끝날 때까지 202)
import { kayakRequest, safeUrl } from './client.js';

const ENTITY = /^k(place|hotel):\d+$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY = /^[A-Z]{3}$/;
const LANGS = { ko: 'ko', en: 'en', ja: 'ja', 'zh-TW': 'zh_TW' };
const SORTS = {
    popularity: ['popularity', 'descending'],
    price: ['minRate', 'ascending'],
    rating: ['consumerRating', 'descending'],
    stars: ['rating', 'descending'],
    distance: ['distance', 'ascending'],
};
const PAGE_SIZE = 20;

function int(value, min, max, fallback) {
    if (value == null || value === '') return fallback;
    const n = Number(value);
    return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

function idList(value, max, itemMax) {
    if (value == null || value === '') return [];
    const parts = String(value).split('|');
    if (parts.length > max || parts.some((p) => !/^\d{1,5}$/.test(p) || Number(p) > itemMax)) return null;
    return parts;
}

const nights = (a, b) => Math.max(1, Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000));
const given = (v) => v != null && v !== '';

/** 쿼리스트링 → 검증된 검색 조건. 틀린 값이 있으면 null */
export function parseHotelQuery(query) {
    const destination = String(query.destination ?? '');
    if (!ENTITY.test(destination)) return null;
    const checkin = String(query.checkin ?? '');
    const checkout = String(query.checkout ?? '');
    if (!YMD.test(checkin) || !YMD.test(checkout) || checkout <= checkin || nights(checkin, checkout) > 30) return null;
    const rooms = int(query.rooms, 1, 4, 1);
    const adults = int(query.adults, 1, 8, 2);
    if (rooms === null || adults === null || adults < rooms) return null;
    const ages = given(query.childAges) ? String(query.childAges).split('|').map(Number) : [];
    if (ages.length > 4 || ages.some((a) => !Number.isInteger(a) || a < 0 || a > 17)) return null;
    const currency = given(query.currency) ? String(query.currency).toUpperCase() : 'USD';
    if (!CURRENCY.test(currency)) return null;
    const lang = LANGS[query.lang ?? 'en'];
    if (!lang) return null;
    const sort = SORTS[query.sort ?? 'popularity'];
    if (!sort) return null;
    const stars = idList(query.stars, 5, 5);
    const facilities = idList(query.facilities, 8, 99999);
    const propertyTypes = idList(query.propertyTypes, 8, 99);
    const minPrice = int(query.minPrice, 0, 100_000_000, null);
    const maxPrice = int(query.maxPrice, 1, 100_000_000, null);
    const guestRating = int(query.guestRating, 1, 10, null);
    const page = int(query.page, 0, 20, 0);
    if (stars === null || facilities === null || propertyTypes === null || page === null) return null;
    if ((given(query.minPrice) && minPrice === null) || (given(query.maxPrice) && maxPrice === null) || (given(query.guestRating) && guestRating === null)) return null;
    return { destination, checkin, checkout, rooms, adults, ages, currency, lang, sort, stars, facilities, propertyTypes, minPrice, maxPrice, guestRating, page };
}

/** 객실별 어른·아이 나이: "2:5|2" = 첫 방 어른 2 + 아이 5살, 둘째 방 어른 2 (아이는 첫 방에) */
export function roomsParam(f) {
    const base = Math.floor(f.adults / f.rooms);
    const extra = f.adults % f.rooms;
    return Array.from({ length: f.rooms }, (_, i) => {
        const a = base + (i < extra ? 1 : 0);
        return i === 0 && f.ages.length ? `${a}:${f.ages.join(',')}` : String(a);
    }).join('|');
}

export function buildHotelQuery(f) {
    return {
        destination: f.destination,
        checkin: f.checkin,
        checkout: f.checkout,
        rooms: roomsParam(f),
        currencyCode: f.currency,
        languageCode: f.lang,
        includeTaxesInTotal: 'true',
        sortField: f.sort[0],
        sortDirection: f.sort[1],
        pageIndex: f.page,
        pageSize: PAGE_SIZE,
        starRating: f.stars.join('|'),
        propertyTypes: f.propertyTypes.join('|'),
        features: f.facilities.join('|'),
        guestRatings: f.guestRating,
        minPrice: f.minPrice,
        maxPrice: f.maxPrice,
        responseOptions: 'images,topRates,filter',
        onlyIfComplete: 'true',
        searchTimeout: 7000,
    };
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Kayak 응답 → 앱 카드 모양 */
export function normalizeHotels(raw, f) {
    const providers = Array.isArray(raw?.providers) ? raw.providers : [];
    const n = nights(f.checkin, f.checkout);
    const hotels = (Array.isArray(raw?.results) ? raw.results : [])
        .map((h) => {
            const rates = (h.rates ?? [])
                .map((r) => {
                    const p = providers[r.providerIndex];
                    const url = safeUrl(r.bookUri);
                    if (!url || num(r.totalRate) === null) return null;
                    return {
                        room: String(r.roomName ?? '').slice(0, 120),
                        total: r.totalRate,
                        freeCancel: Boolean(r.hasFreeCancellation),
                        payLater: Boolean(r.canPayLater),
                        breakfast: Array.isArray(r.inclusions) && r.inclusions.some((i) => i === 0 || i === 3 || i === 4),
                        provider: p?.name ?? '',
                        providerLogo: safeUrl(p?.logo),
                        url,
                    };
                })
                .filter(Boolean)
                .sort((a, b) => a.total - b.total)
                .slice(0, 4);
            if (rates.length === 0) return null;
            return {
                id: h.id,
                name: String(h.translatedName || h.name || '').slice(0, 120),
                address: String(h.address ?? '').slice(0, 160),
                stars: num(h.starRating) ?? 0,
                selfRated: Boolean(h.isSelfRated),
                guestRating: num(h.guestRating),
                reviews: num(h.numberOfReviews),
                distanceM: num(h.distance),
                lat: num(h.latitude),
                lng: num(h.longitude),
                images: (h.images ?? []).map((i) => safeUrl(i.large)).filter(Boolean).slice(0, 6),
                lowest: rates[0].total,
                nights: n,
                freeCancel: rates.some((r) => r.freeCancel),
                rates,
            };
        })
        .filter(Boolean);

    const list = (v) => (Array.isArray(v) ? v : []);
    return {
        complete: Boolean(raw?.isComplete),
        total: raw?.totalFilteredResults ?? hotels.length,
        currency: raw?.currencyCode ?? f.currency,
        nights: n,
        page: f.page,
        hasMore: (f.page + 1) * PAGE_SIZE < (raw?.totalFilteredResults ?? 0),
        hotels,
        filters: {
            priceMin: num(raw?.lowestTotalRate),
            priceMax: num(raw?.highestTotalRate),
            stars: list(raw?.starRatings).map((s) => ({ key: s.key, count: s.value })).filter((s) => s.key >= 1),
            propertyTypes: list(raw?.propertyTypes).filter((p) => p.hotelCount > 0).slice(0, 8).map((p) => ({ id: p.id, name: p.name, count: p.hotelCount })),
            facilities: list(raw?.facilities).filter((p) => p.hotelCount > 0).sort((a, b) => b.hotelCount - a.hotelCount).slice(0, 10).map((p) => ({ id: p.id, name: p.name, count: p.hotelCount })),
        },
    };
}

export async function searchHotels({ filters, req, trackId }) {
    let last = null;
    // onlyIfComplete=true는 끝날 때까지 202를 준다 — 몇 번 더 물어본다
    for (let attempt = 0; attempt < 6; attempt++) {
        last = await kayakRequest('/api/3.0/hotels', { query: buildHotelQuery(filters), req, trackId, timeoutMs: 10_000 });
        if (last.status !== 202) break;
        await new Promise((r) => setTimeout(r, 1200));
    }
    if (!last || last.status !== 200 || !last.json) throw new Error(`kayak hotels HTTP ${last?.status}`);
    return normalizeHotels(last.json, filters);
}
