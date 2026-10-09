// 호텔 검색(도시 검색) — 요청 검증·아고다 요청 만들기·응답 줄이기
import { agodaRequest } from './client.js';
import { cityById, nearestCity } from './cities.js';

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const LANGS = { ko: 'ko-kr', en: 'en-us', ja: 'ja-jp', 'zh-TW': 'zh-tw' };
const CURRENCIES = new Set(['KRW', 'USD', 'JPY', 'TWD', 'EUR', 'GBP', 'CNY', 'HKD', 'SGD', 'THB', 'VND', 'AUD']);
const SORTS = {
    recommended: 'Recommended',
    priceAsc: 'PriceAsc',
    priceDesc: 'PriceDesc',
    starsDesc: 'StarRatingDesc',
    reviewScore: 'AllGuestsReviewScore',
};
export const MAX_RESULTS = 30;
export const MAX_NIGHTS = 30;

const given = (v) => v != null && v !== '';
const nights = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

function num(value, min, max) {
    if (!given(value)) return undefined;
    const n = Number(value);
    return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

/** 쿼리스트링 → 검증된 검색 조건. 틀린 값이 있으면 null */
export function parseHotelQuery(query) {
    const lat = Number(query.lat);
    const lng = Number(query.lng);
    if (!given(query.lat) || !given(query.lng) || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    const checkin = String(query.checkin ?? '');
    const checkout = String(query.checkout ?? '');
    if (!YMD.test(checkin) || !YMD.test(checkout) || checkout <= checkin || nights(checkin, checkout) > MAX_NIGHTS) return null;
    const adults = given(query.adults) ? Number(query.adults) : 2;
    if (!Number.isInteger(adults) || adults < 1 || adults > 8) return null;
    const childAges = given(query.childAges) ? String(query.childAges).split('|').map(Number) : [];
    if (childAges.length > 4 || childAges.some((a) => !Number.isInteger(a) || a < 0 || a > 17)) return null;
    const currency = given(query.currency) ? String(query.currency).toUpperCase() : 'KRW';
    if (!CURRENCIES.has(currency)) return null;
    const language = LANGS[query.lang ?? 'ko'];
    if (!language) return null;
    const sort = SORTS[query.sort ?? 'recommended'];
    if (!sort) return null;
    const minStars = num(query.minStars, 0, 5);
    const minReview = num(query.minReview, 0, 10);
    const minPrice = num(query.minPrice, 0, 100_000_000);
    const maxPrice = num(query.maxPrice, 1, 100_000_000);
    if (minStars === null || minReview === null || minPrice === null || maxPrice === null) return null;
    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) return null;
    // 호텔 이름으로 고른 검색 — 그 호텔(맨 위 고정) + 같은 도시 추천
    const hotelId = given(query.hotelId) ? Number(query.hotelId) : undefined;
    if (hotelId !== undefined && (!Number.isInteger(hotelId) || hotelId < 1 || hotelId > 2_000_000_000)) return null;
    return {
        hotelId,
        lat,
        lng,
        checkin,
        checkout,
        adults,
        childAges,
        currency,
        language,
        sort,
        minStars,
        minReview,
        minPrice,
        maxPrice,
        discountOnly: query.discountOnly === '1' || query.discountOnly === 'true',
    };
}

/** 아고다 요청의 criteria */
export function buildCriteria(f, cityId) {
    const additional = {
        currency: f.currency,
        language: f.language,
        maxResult: MAX_RESULTS,
        sortBy: f.sort,
        discountOnly: f.discountOnly,
        occupancy: { numberOfAdult: f.adults, numberOfChildren: f.childAges.length, ...(f.childAges.length ? { childrenAges: f.childAges } : {}) },
    };
    if (f.minStars) additional.minimumStarRating = f.minStars;
    if (f.minReview) additional.minimumReviewScore = f.minReview;
    if (f.minPrice !== undefined || f.maxPrice !== undefined) additional.dailyRate = { minimum: f.minPrice ?? 0, maximum: f.maxPrice ?? 100_000_000 };
    return { additional, checkInDate: f.checkin, checkOutDate: f.checkout, cityId };
}

/** 호텔 ID 목록 검색(Hotel List Search)의 criteria — 고른 호텔은 필터와 상관없이 보여 주므로 필터는 넣지 않는다 */
export function buildHotelListCriteria(f, hotelId) {
    return {
        additional: {
            currency: f.currency,
            language: f.language,
            occupancy: { numberOfAdult: f.adults, numberOfChildren: f.childAges.length, ...(f.childAges.length ? { childrenAges: f.childAges } : {}) },
        },
        checkInDate: f.checkin,
        checkOutDate: f.checkout,
        hotelId: [hotelId],
    };
}

const finite = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** 예약 링크는 https만 내보낸다(javascript: 같은 주소 차단) */
export function safeUrl(value) {
    if (typeof value !== 'string') return null;
    try {
        const u = new URL(value);
        return u.protocol === 'https:' ? u.href : null;
    } catch {
        return null;
    }
}

/** 사진 주소는 https로(앱 화면이 https라 http 사진은 막힌다) */
export function httpsImage(value) {
    if (typeof value !== 'string') return null;
    try {
        const u = new URL(value.replace(/^http:\/\//i, 'https://'));
        return u.protocol === 'https:' ? u.href : null;
    } catch {
        return null;
    }
}

export function normalizeHotels(json) {
    const rows = Array.isArray(json?.results) ? json.results : [];
    return rows
        .map((r) => {
            const url = safeUrl(r?.landingURL);
            const price = finite(r?.dailyRate);
            if (!url || price === null || typeof r?.hotelName !== 'string') return null;
            const crossed = finite(r.crossedOutRate);
            const discount = finite(r.discountPercentage);
            return {
                id: String(r.hotelId),
                name: r.hotelName,
                stars: finite(r.starRating) ?? 0,
                reviewScore: finite(r.reviewScore),
                reviewCount: finite(r.reviewCount),
                price,
                crossedOut: crossed && crossed > price ? crossed : null,
                discountPct: discount && discount > 0 ? Math.round(discount) : null,
                breakfast: r.includeBreakfast === true,
                wifi: r.freeWifi === true,
                image: httpsImage(r.imageURL),
                lat: finite(r.latitude),
                lng: finite(r.longitude),
                url,
            };
        })
        .filter(Boolean);
}

async function cityHotels(f, city) {
    const { status, json } = await agodaRequest(buildCriteria(f, city.id));
    if (status === 200 || status === 206) return normalizeHotels(json);
    // 결과 없음(204·911)은 실패가 아니라 빈 목록
    if (status === 204 || json?.error?.id === 911) return [];
    throw new Error(`agoda HTTP ${status}${json?.error?.id ? ` error ${json.error.id}` : ''}`);
}

/** 고른 호텔 하나의 가격 — 그 날짜에 객실이 없거나 실패하면 null(같은 도시 목록은 그대로 보여 준다) */
async function pinnedHotel(f, hotelId) {
    try {
        const { status, json } = await agodaRequest(buildHotelListCriteria(f, hotelId));
        if (status === 200 || status === 206) return normalizeHotels(json).find((h) => h.id === String(hotelId)) ?? null;
    } catch (e) {
        console.warn('[agoda] pinned hotel failed:', e instanceof Error ? e.message : e);
    }
    return null;
}

/**
 * 호텔 검색.
 *  · 도시 검색: 좌표로 가장 가까운 도시를 찾아 그 도시의 호텔. 도시를 못 찾으면 { city: null, hotels: [] }
 *  · 호텔 이름으로 고른 검색(f.hotelId + lookupHotel이 준 { cityId, cityName, country }): 그 호텔을 맨 위에 고정(pinned)하고
 *    같은 도시 추천을 아래에 — 고른 호텔은 목록에서 빼서 두 번 나오지 않게. 그 날짜에 고른 호텔 객실이 없으면 pinned는 null.
 */
export async function searchHotels(f, { lookupHotel } = {}) {
    const base = { nights: nights(f.checkin, f.checkout), currency: f.currency };
    if (f.hotelId && lookupHotel) {
        const row = await lookupHotel(f.hotelId);
        if (row) {
            const city = cityById(row.cityId) ?? { id: row.cityId, name: row.cityName ?? '', country: row.country ?? '', distanceKm: 0 };
            const [pinned, list] = await Promise.all([pinnedHotel(f, f.hotelId), cityHotels(f, city)]);
            return { ...base, city, pinned, pinnedId: String(f.hotelId), hotels: list.filter((h) => h.id !== String(f.hotelId)) };
        }
    }
    const city = nearestCity(f.lat, f.lng);
    if (!city) return { ...base, city: null, hotels: [] };
    return { ...base, city, hotels: await cityHotels(f, city) };
}
