// 제휴사 레지스트리 — 새 회사(Trip.com, Agoda 등)는 모듈을 만들고 여기에 붙인다.
//  - NETWORKS: 원래 주소 → 제휴 추적 링크로 바꾸는 쪽(키 확인 + convert)
//  - LINK_BRANDS: 앱이 부르는 brand 이름 → 원래 주소 만들기 + 어느 네트워크로 바꿀지
//  - SALES_PROVIDERS: 관리자 판매 탭에 보이는 회사(fetchSales가 없으면 "연동 전")
import * as myrealtrip from './myrealtrip.js';
import { isConfigured as agodaConfigured } from '../agoda/client.js';
import { sanitizeInput } from '../http.js';

export const NETWORKS = {
    myrealtrip: {
        isConfigured: myrealtrip.isConfigured,
        convert: (url) => myrealtrip.createMylink(url),
        // 마이리얼트립은 대체 링크가 없어서, 변환을 못 하면 원래 주소로라도 보낸다(수수료 없음)
        passThroughWhenUnavailable: true,
    },
    // 제휴 연결 전 — 원래 주소를 그대로 준다(수수료 없음, 저장된 변환 결과도 쓰지 않음). Klook은 트래블페이아웃을 거쳐
    // 제휴 링크로 바꾸다가 트래블페이아웃을 뺐다(2026-10-04). Klook 제휴를 새로 붙이면 그 네트워크를 만들어 klook.network만 바꾼다
    direct: {
        isConfigured: () => false,
        convert: null,
        passThroughWhenUnavailable: true,
    },
};

const KLOOK_LOCALE_PATH = { ko: 'ko', en: 'en-US', ja: 'ja', 'zh-TW': 'zh-TW' };

/**
 * brand별 원래 주소. query는 요청 쿼리스트링, locale은 앱 언어.
 * 못 만들면 null(잘못된 요청). 항공처럼 원래 주소를 API로 받아야 하는 경우가 있어 async.
 */
export const LINK_BRANDS = {
    klook: {
        network: 'direct',
        async target(query, locale) {
            const q = sanitizeInput(query.q ?? query.city, 80);
            return q ? `https://www.klook.com/${KLOOK_LOCALE_PATH[locale]}/search/result/?query=${encodeURIComponent(q)}` : null;
        },
    },
    // kind=search(q: 통합 검색) | page(url: 투어·티켓 상품 주소) | flight(항공 검색 결과)
    myrealtrip: {
        network: 'myrealtrip',
        async target(query) {
            if (query.kind === 'flight') {
                const flight = myrealtrip.parseFlightQuery(query);
                return flight ? myrealtrip.flightLandingUrl(flight) : null;
            }
            if (query.kind === 'page') return myrealtrip.isProductUrl(query.url) ? query.url : null;
            const q = sanitizeInput(query.q, 80);
            return q ? myrealtrip.searchUrl(q) : null;
        },
    },
};

export const SALES_PROVIDERS = [
    {
        id: 'myrealtrip',
        name: 'MyRealTrip',
        isConfigured: myrealtrip.isConfigured,
        fetchSales: myrealtrip.fetchSales,
        dashboardUrl: 'https://partner.myrealtrip.com',
    },
    // Klook — 제휴 연결 전(일반 링크). 트래블페이아웃을 거쳐 연결하던 것을 2026-10-04에 뺐다
    { id: 'klook', name: 'Klook', isConfigured: () => false, fetchSales: null, dashboardUrl: null },
    // 유심사 — 제휴 링크(usimsa.com/affiliate/…)만 붙어 있다(항공 탭 유심·eSIM). 판매 내역은 유심사 파트너 페이지에서
    { id: 'usimsa', name: '유심사', isConfigured: () => false, fetchSales: null, dashboardUrl: null },
    // 호텔 검색 — 앱은 제휴 검색 API(AGODA_API_KEY), 웹은 검색창 위젯. 판매 내역은 제휴 포털(partners.agoda.com)에서 본다(읽는 API는 연동 전)
    { id: 'agoda', name: 'Agoda', isConfigured: agodaConfigured, fetchSales: null, dashboardUrl: 'https://partners.agoda.com' },
];
