import { useEffect, useMemo, useState } from 'react';
import { infiniteQueryOptions, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { fetchKeepingLastGood, readLastGood } from '@/shared/api/lastGood';
import { fetchActivityCategories, fetchActivityPage, listParams, type ActivityPage, type ActivityProduct } from './activityApi';
import { DEFAULT_FILTERS, PRICE_MAX, applyClientFilters, hasClientFilter, type ActivityFilters, type ActivitySort } from './activityFilters';

/** 평점·즉시 확정처럼 받은 결과에서 거르는 필터가 모자라면 다음 쪽을 이어 받는다 — 이 쪽 수까지(쪽당 20개) */
export const MAX_API_PAGES = 5;

const SIX_HOURS = 6 * 60 * 60 * 1000;

/**
 * 목록 쿼리 옵션 — 모달의 미리보기와 화면의 목록이 같은 키(서버가 걸어 주는 조건만)를 쓰므로
 * "결과 보기"를 눌러도 다시 받지 않는다. 평점·즉시 확정은 키에 없다(받은 결과를 다시 거를 뿐).
 */
export function activityListOptions(city: string, sort: ActivitySort, filters: ActivityFilters) {
  // 필터·정렬이 없는 기본 목록만 "마지막으로 잘 받은 상품"을 3일까지 지킨다(shared/api/lastGood.ts) — 못 받거나 빈 목록이 와도
  // 이전 카드를 그대로 보여 준다. 필터·정렬을 건 결과는 정말 0건일 수 있으니 이 안전망을 걸지 않는다
  const baseline = sort === 'recommended' && !filters.category && filters.maxPrice >= PRICE_MAX && !filters.koreanGuide;
  const lastGoodKey = `activityList:${city}`;
  return infiniteQueryOptions({
    queryKey: ['activityList', listParams(city, sort, filters, 1).toString()],
    queryFn: ({ pageParam }) =>
      baseline && pageParam === 1
        ? fetchKeepingLastGood(lastGoodKey, () => fetchActivityPage(city, sort, filters, pageParam), { isEmpty: (page) => page.items.length === 0 })
        : fetchActivityPage(city, sort, filters, pageParam),
    initialData: () => {
      const saved = baseline ? readLastGood<ActivityPage>(lastGoodKey) : undefined;
      return saved ? { pages: [saved], pageParams: [1] } : undefined;
    },
    initialDataUpdatedAt: 0,
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (last.hasNextPage && pages.length < MAX_API_PAGES ? pages.length + 1 : undefined),
    // 빈 목록·실패는 오래 붙잡지 않는다
    staleTime: (query) => ((query.state.data?.pages[0]?.items.length ?? 0) > 0 ? SIX_HOURS : 0),
    retry: 1,
  });
}

function dedupe(items: ActivityProduct[]): ActivityProduct[] {
  const seen = new Set<string>();
  return items.filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)));
}

interface ListArgs {
  city: string;
  sort: ActivitySort;
  filters: ActivityFilters;
  /** 지금 화면에 보여 주려는 개수 — 걸러 낸 결과가 이보다 적으면 다음 쪽을 이어 받는다 */
  shown: number;
  enabled?: boolean;
}

export function useActivityList({ city, sort, filters, shown, enabled = true }: ListArgs) {
  const query = useInfiniteQuery({ ...activityListOptions(city, sort, filters), enabled });
  const { data, hasNextPage, isFetching, isError, fetchNextPage } = query;
  const items = useMemo(() => applyClientFilters(dedupe(data?.pages.flatMap((p) => p.items) ?? []), filters), [data, filters]);

  useEffect(() => {
    if (enabled && hasNextPage && !isFetching && !isError && items.length < shown) void fetchNextPage();
  }, [enabled, hasNextPage, isFetching, isError, items.length, shown, fetchNextPage]);

  return {
    items,
    isLoading: query.isLoading,
    isError: query.isError && !data,
    /** 보여 줄 것이 더 있는가(이미 받은 것 또는 아직 안 받은 쪽) */
    hasMore: items.length > shown || (hasNextPage && !isError),
    /** 더 받는 중(걸러 내느라 이어 받는 경우 포함) */
    isLoadingMore: query.isFetchingNextPage,
    refetch: query.refetch,
  };
}

/** 인기 검색어 칩 — 이 도시의 기본 추천 목록(추천순·필터 없음) 맨 앞 상품 이름. 필터·정렬을 바꿔도 그대로 */
export function useActivityPopularTitles(city: string, enabled: boolean, count: number): string[] {
  const { data } = useInfiniteQuery({
    ...activityListOptions(city, 'recommended', DEFAULT_FILTERS),
    enabled,
    select: (d) => d.pages[0]?.items.slice(0, count).map((p) => p.title) ?? [],
  });
  return data ?? [];
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

interface PreviewArgs {
  city: string;
  sort: ActivitySort;
  draft: ActivityFilters;
  enabled: boolean;
}

/**
 * 필터 모달 아래 "N개 결과 보기"의 숫자. 평점·즉시 확정이 없으면 서버가 준 전체 개수(정확),
 * 있으면 받아 둔 목록 안에서 센 값이라 더 있을 수 있어 exact=false("N개+").
 */
export function useActivityPreview({ city, sort, draft, enabled }: PreviewArgs) {
  const debounced = useDebounced(draft, 400);
  const settled = debounced === draft;
  const query = useInfiniteQuery({ ...activityListOptions(city, sort, debounced), enabled });
  const { data, hasNextPage } = query;
  const clientFiltered = hasClientFilter(debounced);
  const loaded = useMemo(() => dedupe(data?.pages.flatMap((p) => p.items) ?? []), [data]);
  const filteredCount = useMemo(() => applyClientFilters(loaded, debounced).length, [loaded, debounced]);
  const total = data?.pages[0]?.totalCount ?? null;

  if (!enabled || !settled || query.isLoading || (query.isError && !data)) return { count: null as number | null, exact: false, loading: !query.isError };
  if (!clientFiltered) return { count: total ?? loaded.length, exact: total != null || !hasNextPage, loading: false };
  return { count: filteredCount, exact: !hasNextPage, loading: false };
}

/** 그 도시의 카테고리(도시마다 다르다). 못 받으면 빈 목록 — 카테고리 줄은 숨는다 */
export function useActivityCategories(city: string, enabled: boolean) {
  return useQuery({
    queryKey: ['activityCategories', city],
    queryFn: () => fetchActivityCategories(city),
    enabled,
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });
}
