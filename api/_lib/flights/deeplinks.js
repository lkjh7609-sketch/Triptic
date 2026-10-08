// 항공 예약 링크 — 카드의 항공편이 아니라 검색 조건(노선·날짜·인원·좌석)을 예약 사이트에 넘긴다.
// 그래서 한 검색의 모든 카드가 같은 링크 하나를 쓴다(제휴 변환도 검색당 1번).
//  - 한국어: Trip.com KR (직접 제휴 — Allianceid·SID는 계정 값이라 비밀이 아니다, 호텔 때와 같다)
//  - 그 외: Kiwi.com, Travelpayouts 제휴 링크로 변환(TRAVELPAYOUTS_API_TOKEN). 토큰이 없으면 변환 없는 일반 주소(수수료 없음)
// 2026-10-09 실제 Chrome으로 확인: Trip.com(kr.trip.com·www.trip.com)은 노선·날짜·인원·좌석이 채워져 자동 검색되고, Kiwi는 /deep 형식만 된다(아래).
// 아직 못 본 것: Trip.com 프리미엄 이코노미(class=s)·일등석(f) 값, 한국어 외 언어에서의 Travelpayouts 변환 링크.
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

const KIWI_LANG = { en: 'en', ja: 'ja', 'zh-TW': 'tw' };
const KIWI_CURRENCY = { en: 'usd', ja: 'jpy', 'zh-TW': 'twd' };
const KIWI_CABIN = { ECONOMY: 'economy', PREMIUM_ECONOMY: 'premium', BUSINESS: 'business', FIRST: 'first' };

/**
 * Kiwi.com 검색 결과 — /deep 형식. 2026-10-09 실제 브라우저로 확인: 공항·도시 IATA 코드(SEL·ICN) 그대로 받고 결과 화면으로
 * 넘겨 주며 성인·아동·유아·좌석 등급·언어·통화가 채워진다. 결과 경로(/search/results/icn/nrt/…)는 IATA 코드를 못 읽어
 * 출발·도착이 빈 채로 열리고, 언어 코드는 번체가 zh-tw가 아니라 tw다(zh-tw·zh는 영어로 떨어진다).
 */
export function kiwiFlightUrl(search, locale) {
    const params = new URLSearchParams({ from: search.origin, to: search.destination, departure: search.departDate });
    if (search.returnDate) params.set('return', search.returnDate);
    params.set('adults', String(search.adults));
    params.set('children', String(search.children ?? 0));
    params.set('infants', String(search.infants ?? 0));
    params.set('cabinClass', KIWI_CABIN[search.cabin] ?? 'economy');
    params.set('lang', KIWI_LANG[locale] ?? 'en');
    params.set('currency', KIWI_CURRENCY[locale] ?? 'usd');
    return `https://www.kiwi.com/deep?${params.toString()}`;
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
