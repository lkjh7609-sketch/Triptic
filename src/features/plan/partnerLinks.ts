import { useQuery } from '@tanstack/react-query';
import { apiUrl } from '@/shared/api/apiUrl';
import { aiLocale } from '@/shared/api/aiCacheKeys';
import { AFFILIATE_LINKS } from '@/shared/config';
import i18n from '@/shared/i18n';
import { cityDisplayName } from './cityName';

/** 어디서 누른 링크인지(제휴사 리포트·판매 탭의 sub_id) — api/partnerLink.js SUB_ID */
export type PartnerPlacement = 'trip' | 'search' | 'city' | 'ticket' | 'checklist' | 'product' | 'flights' | 'trip_flights' | 'esim';

/**
 * 제휴 링크(api/partnerLink.js — 제휴사는 서버 레지스트리 api/_lib/affiliates, 한 번 변환해 저장).
 * tracked=false는 서버가 변환을 못 해 원래 주소를 준 경우(수수료 없음).
 */
async function requestPartnerLink(params: Record<string, string>): Promise<{ url: string; tracked: boolean }> {
  const res = await fetch(apiUrl(`/api/partnerLink?${new URLSearchParams(params).toString()}`));
  if (!res.ok) throw new Error(`partnerLink HTTP ${res.status}`);
  const json = (await res.json()) as { url?: unknown; tracked?: unknown };
  if (typeof json.url !== 'string') throw new Error('partnerLink: no url');
  return { url: json.url, tracked: json.tracked !== false };
}

async function fetchPartnerLink(params: Record<string, string>): Promise<string> {
  return (await requestPartnerLink(params)).url;
}

/** Klook에서 이 검색어로 검색한 결과로 가는 제휴 링크 */
export function fetchKlookSearchLink(query: string, locale: string, placement: PartnerPlacement): Promise<string> {
  return fetchPartnerLink({ brand: 'klook', q: query, locale: aiLocale(locale), placement });
}

/** 미리 연 새 탭에 링크가 올 때까지 "이동 중" 화면(빈 흰 화면 대신) — 같은 출처 about:blank라 그릴 수 있다 */
function showRedirecting(tab: Window) {
  try {
    const doc = tab.document;
    doc.title = i18n.t('partnerRedirect.title', { ns: 'common' });
    const style = doc.createElement('style');
    style.textContent =
      'html,body{height:100%;margin:0}' +
      'body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;' +
      'font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;' +
      'background:#FDFBF7;color:#57534E;font-size:15px}' +
      '.spinner{width:28px;height:28px;border:3px solid #E7E5E4;border-top-color:#2E4F4F;border-radius:50%;animation:spin .8s linear infinite}' +
      '@keyframes spin{to{transform:rotate(360deg)}}' +
      '@media (prefers-color-scheme:dark){body{background:#0B0F19;color:#94A3B8}.spinner{border-color:#283548;border-top-color:#4FC3F7}}';
    doc.head.appendChild(style);
    const spinner = doc.createElement('div');
    spinner.className = 'spinner';
    const text = doc.createElement('p');
    text.textContent = i18n.t('partnerRedirect.loading', { ns: 'common' });
    doc.body.replaceChildren(spinner, text);
  } catch {
    // 못 그리면 빈 탭 그대로 — 곧 이동한다
  }
}

/**
 * 이미 받아 둔 링크를 새 탭으로 바로 연다(누르는 순간 = 사용자 동작 안이라 iOS도 연다).
 * 링크를 미리 받아 두는 곳(항공 검색, 상품 카드 등)에서 쓴다.
 */
export function openExternal(url: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'sponsored noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * 누른 뒤에 받아오는 링크를 새 탭으로. iOS 팝업 차단을 피하려고 누르는 순간 탭을 먼저
 * 열어 "이동 중" 화면을 띄우고 링크가 오면 그 탭을 보낸다. 탭을 못 열면(차단) 지금 창에서 이동.
 * 링크가 없으면(null) 연 탭을 닫고 false.
 */
export async function openInNewTab(getUrl: () => Promise<string | null>): Promise<boolean> {
  const tab = window.open('', '_blank');
  if (tab) {
    tab.opener = null;
    showRedirecting(tab);
  }
  const url = await getUrl().catch(() => null);
  if (!url) {
    tab?.close();
    return false;
  }
  if (tab) tab.location.href = url;
  else window.location.href = url;
  return true;
}

/** 제휴 링크를 새 탭으로 — 못 받으면 fallbackUrl로 */
function openPartnerLink(params: Record<string, string>, fallbackUrl: string | null): Promise<boolean> {
  return openInNewTab(() => fetchPartnerLink(params).catch(() => fallbackUrl));
}

/**
 * 그 도시의 Klook 투어·액티비티 검색 결과로 가는 링크. 어느 제휴로 바꿀지는 서버(api/partnerLink, brand=klook)가 정한다 —
 * 지금은 제휴 연결 전이라 일반 Klook 주소(트래블페이아웃을 2026-10-04에 뺐다).
 * 새 탭은 iOS가 await 뒤에 열면 막으므로, 링크를 미리 받아 진짜 <a href>로 쓴다. 받기 전이거나 실패하면 Klook 첫 화면으로.
 */
export function useKlookActivitiesLink(
  city: string | null | undefined,
  locale: string,
  placement: PartnerPlacement = 'trip',
): string {
  // Klook 검색어는 도시 이름만("오스트레일리아 뉴사우스웨일스 주 시드니" → "시드니")
  const query = cityDisplayName(city);
  const loc = aiLocale(locale);
  const { data } = useQuery({
    // v2: 트래블페이아웃 링크(klook.tp.st)를 저장해 둔 기기 캐시를 쓰지 않게(2026-10-04)
    queryKey: ['partnerLink', 'klook', 'v2', placement, loc, query.toLowerCase()],
    queryFn: () => fetchKlookSearchLink(query, loc, placement),
    enabled: query.length > 0,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
  return data ?? AFFILIATE_LINKS.klookActivities;
}

/** 검색창에서 입력한 키워드로 Klook 검색(링크는 서버가 정함). 못 받으면 Klook 첫 화면으로 */
export async function openKlookSearch(keyword: string, locale: string, placement: PartnerPlacement = 'search'): Promise<void> {
  await openPartnerLink({ brand: 'klook', q: keyword, locale: aiLocale(locale), placement }, AFFILIATE_LINKS.klookActivities);
}

const MYREALTRIP_SEARCH = 'https://www.myrealtrip.com/search?q=';

/**
 * 마이리얼트립 통합 검색(마이링크). 서버가 키가 없거나 변환에 실패하면 원래 검색 주소를 주고,
 * 서버에 닿지도 못하면 여기서 같은 주소로(수수료는 없음).
 */
export async function openMyrealtripSearch(keyword: string, placement: PartnerPlacement = 'search'): Promise<void> {
  await openPartnerLink({ brand: 'myrealtrip', kind: 'search', q: keyword, placement }, `${MYREALTRIP_SEARCH}${encodeURIComponent(keyword)}`);
}

/** 마이리얼트립 상품 페이지(상품 카드) — 누를 때만 마이링크를 만든다 */
export async function openMyrealtripPage(url: string, placement: PartnerPlacement = 'product'): Promise<void> {
  await openPartnerLink({ brand: 'myrealtrip', kind: 'page', url, placement }, url);
}

export interface FlightSearch {
  origin: string;
  originType: 'city' | 'airport';
  destination: string;
  destinationType: 'city' | 'airport';
  departDate: string;
  /** 없으면 편도 */
  returnDate: string | null;
  adults: number;
  /** 아동(만 2~11세) — 없으면 0 */
  children?: number;
  /** 유아(만 2세 미만, 좌석 없음) — 없으면 0 */
  infants?: number;
  /** 좌석 등급 — 없으면 마이리얼트립 기본값(일반석) */
  cabin?: 'ECONOMY' | 'PREMIUM_ECONOMY' | 'BUSINESS' | 'FIRST';
}

/** 마이리얼트립 항공 검색 결과 링크 요청 값(서버 api/partnerLink.js kind=flight) */
export function flightLinkParams(flight: FlightSearch, placement: PartnerPlacement): Record<string, string> {
  const params: Record<string, string> = {
    kind: 'flight',
    origin: flight.origin,
    origin_type: flight.originType,
    destination: flight.destination,
    destination_type: flight.destinationType,
    depart_date: flight.departDate,
    adults: String(flight.adults),
    placement,
  };
  if (flight.returnDate) params.return_date = flight.returnDate;
  if (flight.children) params.children = String(flight.children);
  if (flight.infants) params.infants = String(flight.infants);
  if (flight.cabin) params.cabin = flight.cabin;
  return params;
}

/** 마이리얼트립 항공 검색 결과(마이링크). 결과 주소는 서버가 만든다 */
export function fetchMyrealtripFlightsLink(flight: FlightSearch, placement: PartnerPlacement): Promise<string> {
  return fetchPartnerLink({ brand: 'myrealtrip', ...flightLinkParams(flight, placement) });
}

/** 추적이 붙은 마이리얼트립 링크만(서버가 변환을 못 해 원래 주소를 주면 실패로 — 미리 받아 둘 땐 저장하지 않게) */
export async function fetchTrackedMyrealtripLink(params: Record<string, string>): Promise<string> {
  const { url, tracked } = await requestPartnerLink({ brand: 'myrealtrip', ...params });
  if (!tracked) throw new Error('partnerLink: not tracked');
  return url;
}

/**
 * 마이리얼트립 마이링크를 미리 받아 둔다 — 누르는 순간 바로 열 수 있게(링크 만드는 데 최대 2초).
 * 같은 (주소, 위치)는 서버가 한 번만 만들어 저장하므로 다시 보면 캐시에서 온다.
 * params가 null이면 받지 않는다. 받기 전·실패면 undefined(누를 때 "이동 중" 탭으로 대신).
 */
export function useMyrealtripLink(params: Record<string, string> | null): string | undefined {
  const key = params
    ? Object.entries(params)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join('&')
    : '';
  const { data } = useQuery({
    queryKey: ['partnerLink', 'myrealtrip', key],
    queryFn: () => fetchTrackedMyrealtripLink(params!),
    enabled: params !== null,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    retry: false,
  });
  return data;
}

/**
 * 검색어 없이 브랜드 첫 페이지로 가는 제휴 링크(출발 전 체크리스트의 eSIM 등).
 * Travelpayouts에서 그 브랜드에 연결돼 있지 않으면 변환이 실패하므로 원래 주소로 대신한다.
 */
export function usePartnerLandingLink(brand: 'yesim', fallbackUrl: string): string {
  const { data } = useQuery({
    queryKey: ['partnerLink', brand, 'checklist'],
    queryFn: async () => {
      const params = new URLSearchParams({ brand, placement: 'checklist' });
      const res = await fetch(apiUrl(`/api/partnerLink?${params.toString()}`));
      if (!res.ok) throw new Error(`partnerLink HTTP ${res.status}`);
      const json = (await res.json()) as { url?: unknown };
      if (typeof json.url !== 'string') throw new Error('partnerLink: no url');
      return json.url;
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
  return data ?? fallbackUrl;
}
