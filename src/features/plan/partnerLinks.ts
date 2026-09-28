import { useQuery } from '@tanstack/react-query';
import { apiUrl } from '@/shared/api/apiUrl';
import { aiLocale } from '@/shared/api/aiCacheKeys';
import { AFFILIATE_LINKS } from '@/shared/config';
import { cityDisplayName } from './cityName';

/**
 * 그 도시의 Klook 투어·액티비티 검색 결과로 가는 제휴 링크(api/partnerLink.js).
 * 새 탭은 iOS가 await 뒤에 열면 막으므로, 링크를 미리 받아 진짜 <a href>로 쓴다.
 * 받기 전이거나 실패하면 Klook 딜 페이지 제휴 링크로 대신 연결한다(수수료는 그대로).
 */
export function useKlookActivitiesLink(city: string | null | undefined, locale: string): string {
  // Klook 검색어는 도시 이름만("오스트레일리아 뉴사우스웨일스 주 시드니" → "시드니")
  const query = cityDisplayName(city);
  const loc = aiLocale(locale);
  const { data } = useQuery({
    queryKey: ['partnerLink', 'klook', loc, query.toLowerCase()],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/partnerLink?brand=klook&city=${encodeURIComponent(query)}&locale=${encodeURIComponent(loc)}`));
      if (!res.ok) throw new Error(`partnerLink HTTP ${res.status}`);
      const json = (await res.json()) as { url?: unknown };
      if (typeof json.url !== 'string') throw new Error('partnerLink: no url');
      return json.url;
    },
    enabled: query.length > 0,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
  return data ?? AFFILIATE_LINKS.klookActivities;
}
