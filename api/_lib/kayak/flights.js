// Kayak 항공 검색 — 요청 검증·본문 만들기·응답을 앱 카드 모양으로 줄이기
// 문서: https://developers.kayak.com/flights-search-api (POST …/search/flight/v1/poll — 시작 후 searchId로 완료될 때까지 폴링)
import { kayakRequest, safeUrl } from './client.js';

const IATA = /^[A-Z]{3}$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const CABINS = { ECONOMY: 'economy', PREMIUM_ECONOMY: 'premiumEconomy', BUSINESS: 'business', FIRST: 'first' };
const SORTS = { best: 'bestValue', price: 'price', duration: 'duration' };
const SEARCH_ID = /^[A-Za-z0-9_-]{4,40}$/;
const CLUSTER = /^[A-Za-z0-9_-]{1,20}$/;
const CURRENCY = /^[A-Z]{3}$/;

function count(value, min, max, fallback) {
    if (value == null || value === '') return fallback;
    const n = Number(value);
    return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

/** 쿼리스트링 → 검증된 검색 조건. 틀린 값이 있으면 null */
export function parseFlightQuery(query) {
    const currency = query.currency == null || query.currency === '' ? 'USD' : String(query.currency).toUpperCase();
    if (!CURRENCY.test(currency)) return null;
    const sort = SORTS[query.sort ?? 'best'];
    if (!sort) return null;
    const stops = query.stops == null || query.stops === '' ? null : count(query.stops, 0, 2, null);
    if (query.stops != null && query.stops !== '' && stops === null) return null;
    const base = { currency, sort: query.sort ?? 'best', kayakSort: sort, stops };

    // 폴링 이어가기 — 검색 조건은 처음 요청에서 이미 정해졌다
    if (query.searchId != null && query.searchId !== '') {
        if (!SEARCH_ID.test(String(query.searchId)) || !CLUSTER.test(String(query.cluster ?? ''))) return null;
        return { ...base, searchId: String(query.searchId), cluster: String(query.cluster) };
    }

    const origin = String(query.origin ?? '').toUpperCase();
    const destination = String(query.destination ?? '').toUpperCase();
    if (!IATA.test(origin) || !IATA.test(destination) || origin === destination) return null;
    const depart = String(query.depart ?? '');
    if (!YMD.test(depart)) return null;
    const ret = query.return == null || query.return === '' ? null : String(query.return);
    if (ret !== null && (!YMD.test(ret) || ret < depart)) return null;
    const adults = count(query.adults, 1, 9, 1);
    const children = count(query.children, 0, 8, 0);
    const infants = count(query.infants, 0, 9, 0);
    if (adults === null || children === null || infants === null || adults + children > 9 || infants > adults) return null;
    const cabin = CABINS[query.cabin ?? 'ECONOMY'];
    if (!cabin) return null;
    return { ...base, origin, destination, depart, return: ret, adults, children, infants, cabin };
}

export function buildFlightBody(f) {
    const resultParameters = {
        currency: f.currency,
        priceMode: 'perPerson',
        pageSize: 40,
        sort: { key: f.kayakSort, direction: 'asc' },
        ...(f.stops !== null ? { maxStops: f.stops } : {}),
    };
    if (f.searchId) return { searchId: f.searchId, resultParameters };
    const leg = (from, to, date) => ({
        origin: { locationType: 'airports', airports: [from] },
        destination: { locationType: 'airports', airports: [to] },
        date,
        flex: 'exact',
    });
    return {
        searchStartParameters: {
            cabin: f.cabin,
            passengers: [...Array(f.adults).fill('ADT'), ...Array(f.children).fill('CHD'), ...Array(f.infants).fill('INL')],
            legs: [leg(f.origin, f.destination, f.depart), ...(f.return ? [leg(f.destination, f.origin, f.return)] : [])],
            filters: { includeSplit: false },
        },
        resultParameters,
    };
}

const bagState = (list) => (Array.isArray(list) && typeof list[0]?.restriction === 'string' ? list[0].restriction : null);

/** Kayak 응답 → { status, searchId, cluster, total, currency, offers[] } (앱이 쓰는 값만) */
export function normalizeFlights(raw) {
    const legsById = raw?.legs ?? {};
    const segById = raw?.segments ?? {};
    const airlines = raw?.airlines ?? {};
    const providers = raw?.providers ?? {};
    const airports = raw?.airports ?? {};

    const offers = (Array.isArray(raw?.results) ? raw.results : [])
        .map((r) => {
            const options = (r.bookingOptions ?? [])
                .filter((o) => typeof o?.displayPrice?.price === 'number' && safeUrl(o.bookingUrl))
                .map((o) => ({
                    price: o.displayPrice.price,
                    providerCode: o.providerCode,
                    providerName: providers[o.providerCode]?.displayName ?? o.providerCode,
                    providerLogo: safeUrl(providers[o.providerCode]?.logoUrls?.imageUrl),
                    bookingUrl: safeUrl(o.bookingUrl),
                    fare: o.fareFamilies?.[0]?.displayName ?? null,
                    carryOn: bagState(o.fees?.carryOnBag),
                    checked: bagState(o.fees?.checkedBag),
                    freeCancel: (o.badges ?? []).some((b) => b.code === 'freeCancellation'),
                }))
                .sort((a, b) => a.price - b.price)
                .slice(0, 4);
            if (options.length === 0) return null;
            const legs = (r.legs ?? []).map((l) => {
                const leg = legsById[l.id];
                const segs = (leg?.segments ?? []).map((s) => segById[s.id]).filter(Boolean);
                if (!leg || segs.length === 0) return null;
                return {
                    depart: leg.departureTime,
                    arrive: leg.arrivalTime,
                    minutes: leg.duration,
                    origin: segs[0].origin,
                    destination: segs[segs.length - 1].destination,
                    stops: segs.length - 1,
                    via: segs.slice(0, -1).map((s) => s.destination),
                    segments: segs.map((s) => ({
                        airline: s.airline,
                        airlineName: airlines[s.airline]?.displayName ?? s.airline,
                        airlineLogo: safeUrl(airlines[s.airline]?.logoUrl),
                        flightNumber: `${s.airline}${s.flightNumber}`,
                        origin: s.origin,
                        destination: s.destination,
                        depart: s.departureTime,
                        arrive: s.arrivalTime,
                    })),
                };
            });
            if (legs.length === 0 || legs.some((l) => !l)) return null;
            return { id: r.id, price: options[0].price, options, legs };
        })
        .filter(Boolean);

    const places = {};
    for (const [code, a] of Object.entries(airports)) places[code] = a?.displayName ?? a?.cityName ?? code;
    return {
        status: raw?.status ?? 'complete',
        searchId: raw?.searchId ?? null,
        cluster: raw?.cluster ?? null,
        total: raw?.totalCount ?? offers.length,
        currency: raw?.currency ?? 'USD',
        places,
        offers,
    };
}

export async function searchFlights({ filters, req, trackId }) {
    const { status, json } = await kayakRequest('/i/api/affiliate/search/flight/v1/poll', {
        method: 'POST',
        query: { cluster: filters.cluster ?? '' },
        body: buildFlightBody(filters),
        req,
        trackId,
        timeoutMs: 15_000,
    });
    if (status !== 200 || !json) throw new Error(`kayak flights HTTP ${status}`);
    return normalizeFlights(json);
}
