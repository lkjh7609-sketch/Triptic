import { useQuery } from '@tanstack/react-query';
import { apiUrl } from '@/shared/api/apiUrl';
import { aiLocale } from '@/shared/api/aiCacheKeys';
import { AFFILIATE_LINKS } from '@/shared/config';
import { cityDisplayName } from './cityName';

/** 어디서 누른 링크인지(Travelpayouts 리포트의 sub_id) — api/partnerLink.js SUB_ID */
export type PartnerPlacement = 'trip' | 'search' | 'city' | 'ticket';

/** Klook에서 이 검색어로 검색한 결과로 가는 제휴 링크(api/partnerLink.js, 서버가 한 번 변환해 저장) */
export async function fetchKlookSearchLink(query: string, locale: string, placement: PartnerPlacement): Promise<string> {
  const params = new URLSearchParams({ brand: 'klook', q: query, locale: aiLocale(locale), placement });
  const res = await fetch(apiUrl(`/api/partnerLink?${params.toString()}`));
  if (!res.ok) throw new Error(`partnerLink HTTP ${res.status}`);
  const json = (await res.json()) as { url?: unknown };
  if (typeof json.url !== 'string') throw new Error('partnerLink: no url');
  return json.url;
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

/**
 * 검색창에서 입력한 키워드로 Klook 검색(제휴 링크). 링크는 누른 뒤에 받아와야 해서,
 * iOS 팝업 차단을 피하려고 누르는 순간 빈 탭을 먼저 열고 링크가 오면 그 탭을 보낸다.
 * 탭을 못 열면(차단) 지금 창에서 이동. 변환이 실패하면 제휴가 붙은 Klook 딜 페이지로.
 */
export async function openKlookSearch(keyword: string, locale: string, placement: PartnerPlacement = 'search'): Promise<void> {
  const tab = window.open('', '_blank');
  if (tab) tab.opener = null;
  let url: string = AFFILIATE_LINKS.klookActivities;
  try {
    url = await fetchKlookSearchLink(keyword, locale, placement);
  } catch {
    // 제휴 링크 변환 실패 — 딜 페이지로
  }
  if (tab) tab.location.href = url;
  else window.location.href = url;
}
