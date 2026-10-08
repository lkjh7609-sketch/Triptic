import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { fetchDestinationNamesByIds } from '@/features/community/communityService';
import { useDestinations } from '@/features/community/hooks/useDestinations';
import { rankSeasonCandidates, type SeasonCandidate, type SeasonClimateTable } from './seasonPicks';

/** 홈 카드 한 장 — 후보에 도시 이름(현재 언어·영어)을 붙인 것 */
export interface SeasonPick extends SeasonCandidate {
  name: string;
  /** 영어 도시 이름 — 여행 만들기·AI 소개에 넘기는 값("Kyoto"에 나라를 붙여 쓴다) */
  nameEn: string;
}

/** 도시별 가기 좋은 달·월별 기후 — 앱에 포함한 정적 파일이라 처음 쓸 때 한 번만 불러온다(따로 묻는 서버 호출 없음) */
function useSeasonClimate() {
  return useQuery({
    queryKey: ['seasonClimate', 'v1'],
    queryFn: async () => (await import('./seasonClimate.json')).default as unknown as SeasonClimateTable,
    staleTime: Infinity,
  });
}

/**
 * 홈 "지금 가기 좋은 여행지" 후보 — 이번 달이 가기 좋은 달인 도시 6곳(인기 먼저). 도시 목록(현재 언어 이름 포함)은 앱이 이미 쓰는
 * 목록을 그대로 쓰고, 영어 이름만 고른 6곳에 대해 따로 받는다. 못 받아도 화면이 깨지지 않는다(섹션만 빠진다).
 */
export function useSeasonPicks(month: number): { data: SeasonPick[] | undefined } {
  const { i18n } = useTranslation();
  const destinations = useDestinations();
  const climate = useSeasonClimate();
  const candidates = useMemo(
    () => (destinations.data && climate.data ? rankSeasonCandidates(destinations.data, climate.data, month) : undefined),
    [destinations.data, climate.data, month],
  );
  const ids = useMemo(() => (candidates ?? []).map((c) => c.id), [candidates]);
  const english = i18n.language === 'en';
  // 결과는 일반 객체로 — 오프라인 캐시(JSON)에 Map을 넣으면 복원 때 `{}`가 되어 `.get()`에서 홈이 죽었다(2026-10-08).
  // 키에 v2를 붙여 예전에 `{}`로 저장된 값을 다시 쓰지 않는다
  const { data: enNames } = useQuery({
    queryKey: ['seasonEnNames', 'v2', ids.join(',')],
    queryFn: async () => Object.fromEntries(await fetchDestinationNamesByIds(ids, 'en')) as Record<string, string>,
    enabled: !english && ids.length > 0,
    staleTime: 60 * 60 * 1000,
  });
  const data = useMemo(() => {
    if (!candidates || !destinations.data) return undefined;
    const byId = new Map(destinations.data.map((d) => [d.id, d.name]));
    return candidates.map((c) => {
      const name = byId.get(c.id) ?? c.slug;
      return { ...c, name, nameEn: english ? name : (enNames?.[c.id] ?? name) };
    });
  }, [candidates, destinations.data, enNames, english]);
  return { data };
}
