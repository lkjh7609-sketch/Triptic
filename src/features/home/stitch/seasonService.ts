import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getSupabaseClient } from '@/shared/api/supabaseClient';
import { fetchDestinationNamesByIds } from '@/features/community/communityService';
import { rankSeasonCandidates, type SeasonCandidate, type SeasonRow } from './seasonPicks';

/** 홈 카드 한 장 — 후보에 도시 이름(현재 언어·영어)을 붙인 것 */
export interface SeasonPick extends SeasonCandidate {
  name: string;
  /** 영어 도시 이름 — 여행 만들기·AI 소개에 넘기는 값("Kyoto"에 나라를 붙여 쓴다) */
  nameEn: string;
}

/** 이번 달이 가기 좋은 달인 도시 중 6곳(인기 먼저) — destination_seasons(0101·0102) */
export async function fetchSeasonPicks(month: number, locale: string): Promise<SeasonPick[]> {
  const { data, error } = await getSupabaseClient()
    .from('destination_seasons')
    .select('best_months, monthly, destination:destinations!inner(id, slug, country_code, lat, lng, cover_url, is_featured, sort_order)')
    .contains('best_months', [month]);
  if (error) throw error;
  const candidates = rankSeasonCandidates((data as unknown as SeasonRow[] | null) ?? [], month);
  if (candidates.length === 0) return [];
  const ids = candidates.map((c) => c.id);
  const [names, en] = await Promise.all([fetchDestinationNamesByIds(ids, locale), locale === 'en' ? null : fetchDestinationNamesByIds(ids, 'en')]);
  return candidates.map((c) => ({ ...c, name: names.get(c.id) ?? c.slug, nameEn: (en ?? names).get(c.id) ?? c.slug }));
}

/** 홈 "지금 가기 좋은 여행지" 후보. 못 받아도 화면이 깨지지 않는다(섹션만 빠진다) */
export function useSeasonPicks(month: number) {
  const { i18n } = useTranslation();
  return useQuery({
    queryKey: ['seasonPicks', month, i18n.language, 'v1'],
    queryFn: () => fetchSeasonPicks(month, i18n.language),
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });
}
