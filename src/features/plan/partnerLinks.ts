import { useQuery } from '@tanstack/react-query';
import { apiUrl } from '@/shared/api/apiUrl';
import { aiLocale } from '@/shared/api/aiCacheKeys';
import { AFFILIATE_LINKS } from '@/shared/config';
import { cityDisplayName } from './cityName';

/** 어디서 누른 링크인지(제휴사 리포트·판매 탭의 sub_id) — api/partnerLink.js SUB_ID */
export type PartnerPlacement = 'trip' | 'search' | 'city' | 'ticket' | 'checklist' | 'product' | 'flights' | 'trip_flights';

/** 제휴 링크(api/partnerLink.js — 제휴사는 서버 레지스트리 api/_lib/affiliates, 한 번 변환해 저장) */
async function fetchPartnerLink(params: Record<string, string>): Promise<string> {
  const res = await fetch(apiUrl(`/api/partnerLink?${new URLSearchParams(params).toString()}`));
  if (!res.ok) throw new Error(`partnerLink HTTP ${res.status}`);
  const json = (await res.json()) as { url?: unknown };
  if (typeof json.url !== 'string') throw new Error('partnerLink: no url');
  return json.url;
}

/** Klook에서 이 검색어로 검색한 결과로 가는 제휴 링크 */
export function fetchKlookSearchLink(query: string, locale: string, placement: PartnerPlacement): Promise<string> {
  return fetchPartnerLink({ brand: 'klook', q: query, locale: aiLocale(locale), placement });
}

/**
 * 누른 뒤에 받아오는 링크를 새 탭으로. iOS 팝업 차단을 피하려고 누르는 순간 빈 탭을 먼저
 * 열고 링크가 오면 그 탭을 보낸다. 탭을 못 열면(차단) 지금 창에서 이동.
 * 링크가 없으면(null) 연 탭을 닫고 false.
 */
export async function openInNewTab(getUrl: () => Promise<string | null>): Promise<boolean> {
  const tab = window.open('', '_blank');
  if (tab) tab.opener = null;
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
 * 그 도시의 Klook 투어·액티비티 검색 결과로 가는 제휴 링크.
 * 새 탭은 iOS가 await 뒤에 열면 막으므로, 링크를 미리 받아 진짜 <a href>로 쓴다.
 * 받기 전이거나 실패하면 Klook 딜 페이지 제휴 링크로 대신 연결한다(수수료는 그대로).
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
    queryKey: ['partnerLink', 'klook', placement, loc, query.toLowerCase()],
    queryFn: () => fetchKlookSearchLink(query, loc, placement),
    enabled: query.length > 0,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
  return data ?? AFFILIATE_LINKS.klookActivities;
}

/** 검색창에서 입력한 키워드로 Klook 검색(제휴 링크). 변환이 실패하면 제휴가 붙은 Klook 딜 페이지로 */
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
}

/** 마이리얼트립 항공 검색 결과(마이링크). 결과 주소는 서버가 만든다 */
export function fetchMyrealtripFlightsLink(flight: FlightSearch, placement: PartnerPlacement): Promise<string> {
  const params: Record<string, string> = {
    brand: 'myrealtrip',
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
  return fetchPartnerLink(params);
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
