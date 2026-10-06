// 주변 추천의 '장소 고르기'는 구글 Places(Nearby Search)가 하고, AI는 고른 장소에 추천 문구만 붙인다(하이브리드).
// AI가 장소 이름을 지어내거나 엉뚱한 곳 좌표가 붙던 문제를 없앤다. 조건에 맞는 곳이 9곳에 못 미치면 찾은 만큼만 보여 준다.
import { GROUP_SIZE, GROUPS } from './nearbyMix.js';

/** 후보 조건 — 이 평점·리뷰 수 이상, 영업 중인 곳만 */
export const MIN_RATING = 4.0;
export const MIN_REVIEWS = 50;
/** 묶음(식당·카페·볼거리)마다 풀에 쌓아 두는 최대 수 — 보여 줄 3곳을 무작위로 고를 여유 */
export const KEEP_PER_GROUP = GROUP_SIZE * 2;
const SEARCH_RADIUS_M = 500;

/** Places API(New) Table A 유형 — 묶음마다 */
export const GROUP_TYPES = {
    restaurant: ['restaurant'],
    cafe: ['cafe', 'coffee_shop'],
    sight: ['tourist_attraction', 'park', 'museum', 'art_gallery', 'historical_landmark', 'zoo', 'aquarium', 'amusement_park', 'shopping_mall'],
};
const CULTURE_TYPES = new Set(['museum', 'art_gallery', 'historical_landmark']);

const FIELD_MASK = [
    'places.id',
    'places.displayName',
    'places.formattedAddress',
    'places.location',
    'places.types',
    'places.primaryType',
    'places.rating',
    'places.userRatingCount',
    'places.businessStatus',
].join(',');

/** 한 묶음의 인기 장소를 기준점 반경 500m에서 가져온다. 실패하면 던진다(호출부가 다른 방법으로 넘어감) */
export async function searchNearbyGroup({ apiKey, bias, group, locale }) {
    const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': FIELD_MASK },
        body: JSON.stringify({
            includedTypes: GROUP_TYPES[group],
            maxResultCount: 20,
            rankPreference: 'POPULARITY',
            languageCode: locale,
            locationRestriction: { circle: { center: { latitude: bias.lat, longitude: bias.lng }, radius: SEARCH_RADIUS_M } },
        }),
        signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`places:searchNearby ${res.status}`);
    const json = await res.json();
    return (json.places ?? []).map((p) => ({ ...p, group }));
}

function categoryOf(group, p) {
    if (group === 'restaurant') return 'restaurant';
    if (group === 'cafe') return 'cafe';
    return CULTURE_TYPES.has(p.primaryType) ? 'culture' : 'spot';
}

/** 평점·리뷰 수·영업 여부로 거르고, 묶음마다 평가가 좋고 많이 찾는 순으로 KEEP_PER_GROUP곳만 남긴다 */
export function selectCandidates(places, { basePlaceId = null } = {}) {
    const out = [];
    for (const group of GROUPS) {
        const rows = places
            .filter((p) => p.group === group)
            .filter((p) => p.id && p.id !== basePlaceId)
            .filter((p) => (p.rating ?? 0) >= MIN_RATING && (p.userRatingCount ?? 0) >= MIN_REVIEWS)
            .filter((p) => !p.businessStatus || p.businessStatus === 'OPERATIONAL')
            .filter((p) => !(p.types ?? []).includes('lodging'))
            .filter((p) => typeof p.location?.latitude === 'number' && typeof p.location?.longitude === 'number')
            .filter((p) => (p.displayName?.text ?? '').trim());
        const seen = new Set();
        const score = (p) => p.rating * Math.log10(p.userRatingCount + 10);
        for (const p of rows.sort((a, b) => score(b) - score(a))) {
            if (seen.has(p.id)) continue;
            seen.add(p.id);
            if (seen.size > KEEP_PER_GROUP) break;
            out.push({
                placeId: p.id,
                name: p.displayName.text.trim().slice(0, 120),
                address: (p.formattedAddress ?? '').slice(0, 200),
                lat: p.location.latitude,
                lng: p.location.longitude,
                category: categoryOf(group, p),
                rating: p.rating,
                reviews: p.userRatingCount,
            });
        }
    }
    return out;
}

/** 고른 장소에 추천 문구만 붙이게 하는 프롬프트 — 장소를 더하거나 바꾸지 못하게 한다 */
export function buildBlurbPrompt({ candidates, placeName, city, languageName }) {
    const list = candidates.map((c, i) => ({ index: i, name: c.name, category: c.category, rating: c.rating, reviews: c.reviews, address: c.address }));
    return `You are a travel guide. A traveler is near "${placeName}"${city ? ` in ${city}` : ''}.
Below are real places already chosen from Google Maps. Write a short recommendation for EACH of them. Do not add, remove or rename places.
Write every text field in ${languageName}. Describe each place on its own merits; do not mention distance or direction from "${placeName}".
Use only widely known facts. If you are not sure about the signature dish/highlight or the price range, use an empty string instead of guessing.

Places:
${JSON.stringify(list)}

Respond with JSON only, in this shape:
{
  "places": [
    { "index": 0, "categoryLabel": "short category label", "signatureMenu": "signature dish or highlight", "priceRange": "typical price range", "reason": "one or two short sentences on why it is worth visiting", "tip": "one short practical visiting tip" }
  ]
}`;
}

const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** AI가 돌려준 문구를 index로 후보에 붙인다 — 문구가 없거나 이상하면 빈 문구로 둔다(장소는 그대로 보여 줌) */
export function applyBlurbs(candidates, parsed) {
    const byIndex = new Map();
    for (const item of Array.isArray(parsed?.places) ? parsed.places : []) {
        if (Number.isInteger(item?.index)) byIndex.set(item.index, item);
    }
    return candidates.map((c, i) => {
        const b = byIndex.get(i);
        return {
            ...c,
            categoryLabel: text(b?.categoryLabel, 40),
            signatureMenu: text(b?.signatureMenu, 120),
            priceRange: text(b?.priceRange, 60),
            reason: text(b?.reason, 400),
            tip: text(b?.tip, 300),
        };
    });
}
