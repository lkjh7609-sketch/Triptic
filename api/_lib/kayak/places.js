// Kayak 자동완성 — 항공(공항·도시 코드)과 호텔(도시·호텔 entityKey)
import { sanitizeInput } from '../http.js';
import { kayakRequest } from './client.js';

const IATA = /^[A-Z]{3}$/;

export function normalizeFlightPlaces(json) {
    const rows = Array.isArray(json?.results) ? json.results : [];
    return rows
        .filter((r) => typeof r?.iataCode === 'string' && IATA.test(r.iataCode))
        .slice(0, 8)
        .map((r) => ({
            code: r.iataCode,
            // 도시 코드(모든 공항)는 isMetro, 도시 이름 자체가 대상
            type: r.isMetro || r.primaryPlaceType === 'city' ? 'city' : 'airport',
            name: r.isMetro || r.primaryPlaceType === 'city' ? (r.cityName ?? r.name) : r.name,
            detail: [r.primaryPlaceType === 'airport' ? r.cityName : null, r.countryName].filter(Boolean).join(', ') || null,
        }));
}

const HOTEL_KIND = new Set(['city', 'hotel', 'region', 'touristregion', 'neighborhood', 'landmark', 'airport', 'island', 'nationalpark', 'country']);

export function normalizeHotelPlaces(json) {
    const rows = Array.isArray(json?.results) ? json.results : [];
    return rows
        .filter((r) => typeof r?.entityKey === 'string' && /^k(place|hotel):\d+$/.test(r.entityKey))
        .slice(0, 8)
        .map((r) => ({
            key: r.entityKey,
            kind: HOTEL_KIND.has(r.primaryPlaceType) ? r.primaryPlaceType : 'city',
            name: r.name,
            detail: [r.cityName && r.cityName !== r.name ? r.cityName : null, r.regionName && r.regionName !== r.name ? r.regionName : null, r.countryName]
                .filter(Boolean)
                .filter((v, i, a) => a.indexOf(v) === i)
                .join(', ') || null,
        }));
}

/** type: 'flights' | 'hotels' */
export async function searchPlaces({ type, q, req, trackId }) {
    const term = sanitizeInput(q, 60);
    if (term.length < 1) return { items: [] };
    const { status, json } = await kayakRequest(`/api/affiliate/autocomplete/v1/${type}`, { query: { searchTerm: term }, req, trackId, timeoutMs: 6000 });
    if (status !== 200) throw new Error(`kayak autocomplete HTTP ${status}`);
    return { items: type === 'flights' ? normalizeFlightPlaces(json) : normalizeHotelPlaces(json) };
}
