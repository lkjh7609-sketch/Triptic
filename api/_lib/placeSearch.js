// 장소 검색 보조: 자동완성이 비었을 때 앱이 부르는 서버 검색(api/recommend.js mode=placeSearch).
// 순서: 1) 같은 도시권·같은 검색어 캐시(기간 제한 없음, 사용자 결정) → 2) 우리 장소 풀(ai_places) → 3) 구글 Text Search(하루 한도).
// 구글 호출만 돈이 들므로 1·2에서 끝나면 부르지 않는다.
import { normalizeKey } from './http.js';

export const SEARCH_RADIUS_KM = 200;
/** 구글을 직접 부르는 검색의 하루(24시간) 한도 — 무료·프로 */
export const PLACE_SEARCH_KIND = 'place.search';
export const PLACE_SEARCH_DAILY_LIMIT = { free: 5, pro: 20 };
const MAX_RESULTS = 6;
const POOL_ENOUGH = 3;

export function boundsAround(lat, lng, km = SEARCH_RADIUS_KM) {
    const dLat = km / 111;
    const dLng = km / (111 * Math.max(Math.cos((lat * Math.PI) / 180), 0.1));
    return { south: lat - dLat, north: lat + dLat, west: lng - dLng, east: lng + dLng };
}

/** 같은 도시권(약 55km 칸)·같은 언어·같은 검색어면 같은 키 */
export function cacheKey(locale, q, bias) {
    const cell = bias ? `${Math.round(bias.lat * 2)}:${Math.round(bias.lng * 2)}` : 'none';
    return `${locale}|${cell}|${normalizeKey(q)}`;
}

/** places:searchText 응답 한 건 → 앱의 SelectedPlace 모양 */
export function mapGooglePlace(p) {
    const lat = p?.location?.latitude;
    const lng = p?.location?.longitude;
    if (typeof lat !== 'number' || typeof lng !== 'number') return null;
    const name = (p.displayName?.text ?? p.formattedAddress ?? '').trim();
    if (!name) return null;
    return {
        name: name.slice(0, 120),
        address: (p.formattedAddress ?? '').slice(0, 200),
        lat,
        lng,
        placeId: typeof p.id === 'string' ? p.id : null,
        types: Array.isArray(p.types) ? p.types.slice(0, 10) : [],
        countryCode: p.addressComponents?.find((c) => c.types?.includes('country'))?.shortText ?? null,
    };
}

function quoted(value) {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

async function readCache(db, key) {
    const { data, error } = await db.from('place_search_cache').select('results').eq('query_key', key).maybeSingle();
    if (error || !Array.isArray(data?.results)) return null;
    return data.results;
}

async function writeCache(db, key, results) {
    const { error } = await db.from('place_search_cache').upsert({ query_key: key, results, created_at: new Date().toISOString() });
    if (error) console.warn('[placeSearch] cache write failed:', error.message);
}

/** 우리 장소 풀에서 이름·분류 이름에 검색어가 들어간 곳 */
async function searchPool(db, q, locale, bias) {
    if (!bias) return [];
    const b = boundsAround(bias.lat, bias.lng);
    const like = quoted(`%${q.replace(/[\\%_]/g, '\\$&')}%`);
    const { data, error } = await db
        .from('ai_places')
        .select('place_id, name, address, lat, lng, category')
        .eq('locale', locale)
        .gte('lat', b.south)
        .lte('lat', b.north)
        .gte('lng', b.west)
        .lte('lng', b.east)
        .or(`name.ilike.${like},category_label.ilike.${like}`)
        .limit(MAX_RESULTS);
    if (error) return [];
    return (data ?? []).map((r) => ({ name: r.name, address: r.address ?? '', lat: r.lat, lng: r.lng, placeId: r.place_id, types: [], countryCode: null }));
}

async function searchGoogle({ apiKey, q, locale, bias }) {
    const body = { textQuery: q, languageCode: locale, maxResultCount: MAX_RESULTS };
    if (bias) {
        const b = boundsAround(bias.lat, bias.lng);
        body.locationRestriction = { rectangle: { low: { latitude: b.south, longitude: b.west }, high: { latitude: b.north, longitude: b.east } } };
    }
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.addressComponents',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`places:searchText ${res.status}`);
    const json = await res.json();
    return (json.places ?? []).map(mapGooglePlace).filter(Boolean);
}

/**
 * @returns {{results: object[], source: 'cache'|'pool'|'google', limited?: boolean} | {unavailable: true}}
 * unavailable: 서버가 구글을 부를 수 없다(키 없음·API 꺼짐 등) — 앱이 브라우저에서 직접 찾게 한다
 */
export async function placeSearch({ db, apiKey, q, locale, bias, takeQuota }) {
    const key = cacheKey(locale, q, bias);
    if (db) {
        const cached = await readCache(db, key);
        if (cached) return { results: cached, source: 'cache' };
    }
    const pool = db ? await searchPool(db, q, locale, bias) : [];
    if (pool.length >= POOL_ENOUGH) return { results: pool, source: 'pool' };
    if (!apiKey) return { unavailable: true };
    try {
        await takeQuota();
    } catch {
        // 하루 한도를 다 썼거나 한도를 확인할 수 없으면(닫힌 쪽) 구글은 부르지 않고 풀 결과만 돌려준다
        return { results: pool, source: 'pool', limited: true };
    }
    let google;
    try {
        google = await searchGoogle({ apiKey, q, locale, bias });
    } catch (e) {
        console.warn('[placeSearch] google failed:', e.message);
        return { unavailable: true };
    }
    const seen = new Set(pool.map((p) => p.placeId));
    const results = [...pool, ...google.filter((g) => !seen.has(g.placeId))].slice(0, MAX_RESULTS);
    if (db) await writeCache(db, key, results);
    return { results, source: 'google' };
}
