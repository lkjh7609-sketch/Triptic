// 항공 예약 링크 — 카드의 항공편이 아니라 검색 조건(노선·날짜·인원·좌석)을 예약 사이트에 넘긴다.
// 그래서 한 검색의 모든 카드가 같은 링크 하나를 쓴다(제휴 변환도 검색당 1번).
//  - 한국어: Trip.com KR (직접 제휴 — Allianceid·SID는 계정 값이라 비밀이 아니다, 호텔 때와 같다)
//  - 그 외: Kiwi.com, Travelpayouts 제휴 링크로 변환(TRAVELPAYOUTS_API_TOKEN). 토큰이 없으면 변환 없는 일반 주소(수수료 없음)
// 주소 모양은 파트너 센터가 만들어 준 것을 기준으로 했다. 짐작한 매개변수는 실제 브라우저에서 확인할 것.
import * as travelpayouts from '../affiliates/travelpayouts.js';

const TRIP_ALLIANCE_ID = process.env.TRIPCOM_ALLIANCE_ID || '10792895';
const TRIP_SID = process.env.TRIPCOM_SID || '332524291';
// 파트너 센터 '링크 만들기'가 항공 링크에 붙여 준 표시
const TRIP_SUB3 = 'D20148424';
const TRIP_CABIN = { ECONOMY: 'y', PREMIUM_ECONOMY: 's', BUSINESS: 'c', FIRST: 'f' };

/** Trip.com 항공 검색 결과 — 한국어 사이트(kr.trip.com) */
export function tripcomFlightUrl(search) {
    const { origin, destination } = search;
    const params = new URLSearchParams({
        flighttype: search.returnDate ? 'RT' : 'OW',
        dcity: origin,
        acity: destination,
        ddate: search.departDate,
    });
    if (search.returnDate) params.set('rdate', search.returnDate);
    params.set('class', TRIP_CABIN[search.cabin] ?? 'y');
    params.set('quantity', String(search.adults));
    params.set('childqty', String(search.children ?? 0));
    params.set('babyqty', String(search.infants ?? 0));
    params.set('Allianceid', TRIP_ALLIANCE_ID);
    params.set('SID', TRIP_SID);
    params.set('trip_sub1', 'flights_results');
    params.set('trip_sub3', TRIP_SUB3);
    return `https://kr.trip.com/flights/${origin}-to-${destination}/tickets-${origin}-${destination}?${params.toString()}`;
}

const KIWI_PATH = { en: 'en', ja: 'ja', 'zh-TW': 'zh-tw' };
const KIWI_CURRENCY = { en: 'usd', ja: 'jpy', 'zh-TW': 'twd' };

/** Kiwi.com 검색 결과 — 출발·도착은 IATA 코드(공항·도시 모두 받는다), 왕복이면 날짜를 하나 더 */
export function kiwiFlightUrl(search, locale) {
    const dates = search.returnDate ? `${search.departDate}/${search.returnDate}` : search.departDate;
    const params = new URLSearchParams({
        adults: String(search.adults),
        children: String(search.children ?? 0),
        infants: String(search.infants ?? 0),
        currency: KIWI_CURRENCY[locale] ?? 'usd',
    });
    const path = KIWI_PATH[locale] ?? 'en';
    return `https://www.kiwi.com/${path}/search/results/${search.origin.toLowerCase()}/${search.destination.toLowerCase()}/${dates}/?${params.toString()}`;
}

const KIWI_SUB_ID = 'flights_results';

/**
 * 이 검색의 예약 링크. 항상 { url, tracked }를 돌려주고 던지지 않는다(링크 변환이 실패해도 결과 목록은 보여야 하니까).
 * db는 supabaseAdmin()(없으면 null) — 같은 (주소, sub_id) 변환 결과를 partner_links에 저장해 한 번만 변환한다.
 */
export async function bookingLinkFor(search, locale, db) {
    if (locale === 'ko') return { url: tripcomFlightUrl(search), tracked: true };

    const url = kiwiFlightUrl(search, locale);
    if (!travelpayouts.isConfigured()) return { url, tracked: false };
    try {
        if (db) {
            const { data: hit, error } = await db.from('partner_links').select('partner_url').match({ url, sub_id: KIWI_SUB_ID }).maybeSingle();
            if (error) console.warn('[flights] link cache read failed:', error.message);
            if (hit?.partner_url) return { url: hit.partner_url, tracked: true };
        }
        const { partnerUrl, externalId } = await travelpayouts.convert(url, KIWI_SUB_ID);
        if (db) {
            const { error } = await db
                .from('partner_links')
                .upsert({ url, sub_id: KIWI_SUB_ID, brand: 'kiwi', partner_url: partnerUrl, external_id: externalId });
            if (error) console.warn('[flights] link cache write failed:', error.message);
        }
        return { url: partnerUrl, tracked: true };
    } catch (e) {
        console.warn('[flights] kiwi link conversion failed:', e instanceof Error ? e.message : e);
        return { url, tracked: false };
    }
}
