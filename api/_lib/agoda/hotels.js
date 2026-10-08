// 호텔 검색(도시 검색) — 요청 검증·아고다 요청 만들기·응답 줄이기
import { agodaRequest } from './client.js';
import { nearestCity } from './cities.js';

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
    return {
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

/**
 * 좌표로 가장 가까운 도시를 찾아 그 도시의 호텔을 검색한다.
 * 도시를 못 찾으면 { city: null, hotels: [] }, 결과가 없으면(아고다 오류 911) hotels는 빈 목록.
 */
export async function searchHotels(f) {
    const city = nearestCity(f.lat, f.lng);
    if (!city) return { city: null, hotels: [], nights: nights(f.checkin, f.checkout), currency: f.currency };
    const { status, json } = await agodaRequest(buildCriteria(f, city.id));
    if (status === 200 || status === 206) {
        return { city, hotels: normalizeHotels(json), nights: nights(f.checkin, f.checkout), currency: f.currency };
    }
    // 결과 없음(204·911)은 실패가 아니라 빈 목록
    if (status === 204 || json?.error?.id === 911) return { city, hotels: [], nights: nights(f.checkin, f.checkout), currency: f.currency };
    throw new Error(`agoda HTTP ${status}${json?.error?.id ? ` error ${json.error.id}` : ''}`);
}
