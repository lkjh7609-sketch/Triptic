import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  getDestinationFollowerCount,
  getDestinationGuide,
  getPinnedPost,
  listPopularTags,
  listPosts,
  type PostCursor,
  type PostSort,
} from '../communityService';
import type { PostCategory } from '../postMeta';
import {
  listCompanionPosts,
  listUrgentCompanionPosts,
  type CompanionSort,
} from '../companionService';

const DAY_MS = 24 * 60 * 60 * 1000;

export function useDestinationGuide(destinationId: string | undefined) {
  return useQuery({
    queryKey: ['community', 'destination-guide', destinationId ?? ''],
    queryFn: () => getDestinationGuide(destinationId!),
    enabled: !!destinationId,
    staleTime: DAY_MS,
  });
}

export function useDestinationFollowerCount(destinationId: string | undefined) {
  return useQuery({
    queryKey: ['community', 'destination-followers', destinationId ?? ''],
    queryFn: () => getDestinationFollowerCount(destinationId!),
    enabled: !!destinationId,
    staleTime: 60 * 1000,
  });
}

export function useUrgentCompanions(destinationId: string | undefined) {
  return useQuery({
    queryKey: ['community', 'companion', 'urgent', destinationId ?? ''],
    queryFn: () => listUrgentCompanionPosts(destinationId!, 2),
    enabled: !!destinationId,
    staleTime: 60 * 1000,
  });
}

/** 도시의 고정 글(트립틱 공식 필독 가이드) */
export function usePinnedPost(destinationId: string | undefined, viewerId: string | null) {
  return useQuery({
    queryKey: ['community', 'pinned', destinationId ?? '', viewerId ?? ''],
    queryFn: () => getPinnedPost(destinationId!, viewerId),
    enabled: !!destinationId,
    staleTime: 60 * 1000,
  });
}

/** 도시 인기 태그 상위 6개 */
export function usePopularTags(destinationId: string | undefined) {
  return useQuery({
    queryKey: ['community', 'popular-tags', destinationId ?? ''],
    queryFn: () => listPopularTags(destinationId!, 6),
    enabled: !!destinationId,
    staleTime: 5 * 60 * 1000,
  });
}

interface ChannelPostsArgs {
  destinationId: string | undefined;
  /** 도시 대신 자유게시판(도시 없는 글) */
  freeBoard?: boolean;
  viewerId: string | null;
  search: string;
  sort: PostSort;
  /** 없으면 전체 분류 */
  category?: PostCategory;
  /** 없으면 태그 필터 없음 */
  tag?: string;
}

type PostsParam = { cursor: PostCursor | null; offset: number };
const FIRST_PAGE: PostsParam = { cursor: null, offset: 0 };

/** 도시 채널의 글 목록 — 최신순은 커서, 인기·댓글순은 위치로 이어 받는다 */
export function useChannelPosts({ destinationId, freeBoard, viewerId, search, sort, category, tag }: ChannelPostsArgs) {
  return useInfiniteQuery({
    queryKey: [
      'community',
      'channel-feed',
      freeBoard ? 'free' : (destinationId ?? ''),
      viewerId ?? '',
      search,
      sort,
      category ?? '',
      tag ?? '',
    ] as const,
    queryFn: ({ pageParam }: { pageParam: PostsParam }) =>
      listPosts({
        destinationId,
        freeBoard,
        viewerId,
        search,
        sort,
        category,
        tag,
        // 고정 글은 목록 맨 위에 따로 보여 주므로 목록에서는 뺀다
        hidePinned: true,
        cursor: pageParam.cursor,
        offset: pageParam.offset,
      }),
    initialPageParam: FIRST_PAGE,
    getNextPageParam: (last): PostsParam | undefined => {
      if (last.nextCursor) return { cursor: last.nextCursor, offset: 0 };
      if (last.nextOffset != null) return { cursor: null, offset: last.nextOffset };
      return undefined;
    },
    enabled: !!destinationId || !!freeBoard,
  });
}

interface ChannelCompanionsArgs {
  destinationId: string | undefined;
  viewerId: string | null;
  search: string;
  sort: CompanionSort;
}

/** 도시 채널의 동행 구하기 목록 */
export function useChannelCompanions({
  destinationId,
  viewerId,
  search,
  sort,
}: ChannelCompanionsArgs) {
  return useInfiniteQuery({
    queryKey: [
      'community',
      'companion',
      'channel-feed',
      destinationId ?? '',
      viewerId ?? '',
      search,
      sort,
    ] as const,
    queryFn: ({ pageParam }: { pageParam: PostsParam }) =>
      listCompanionPosts({
        destinationId,
        viewerId,
        search,
        sort,
        cursor: pageParam.cursor,
        offset: pageParam.offset,
      }),
    initialPageParam: FIRST_PAGE,
    getNextPageParam: (last): PostsParam | undefined => {
      if (last.nextCursor) return { cursor: last.nextCursor, offset: 0 };
      if (last.nextOffset != null) return { cursor: null, offset: last.nextOffset };
      return undefined;
    },
    enabled: !!destinationId,
  });
}

/** 도시 하나의 지금 날씨 — 기온·체감 기온(℃)과 WMO 날씨 코드(Open-Meteo, 키 없음) */
export interface CurrentWeather {
  temp: number;
  feelsLike: number | null;
  code: number | null;
}

interface OpenMeteoCurrent {
  current?: {
    temperature_2m?: number | null;
    apparent_temperature?: number | null;
    weather_code?: number | null;
  };
}

export async function fetchCurrentWeather(lat: number, lng: number): Promise<CurrentWeather> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current: 'temperature_2m,apparent_temperature,weather_code',
    timezone: 'auto',
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!res.ok) throw new Error(`open-meteo HTTP ${res.status}`);
  const json = (await res.json()) as OpenMeteoCurrent;
  const temp = json.current?.temperature_2m;
  if (typeof temp !== 'number' || !Number.isFinite(temp))
    throw new Error('open-meteo: no temperature');
  const feels = json.current?.apparent_temperature;
  const code = json.current?.weather_code;
  return {
    temp,
    feelsLike: typeof feels === 'number' && Number.isFinite(feels) ? feels : null,
    code: typeof code === 'number' ? code : null,
  };
}

export function useCurrentWeather(lat: number | undefined, lng: number | undefined) {
  const enabled = lat != null && lng != null;
  return useQuery({
    queryKey: ['community', 'destination-weather', lat ?? null, lng ?? null],
    queryFn: () => fetchCurrentWeather(lat!, lng!),
    enabled,
    staleTime: 30 * 60 * 1000,
    retry: false, // 실패하면 날씨 칸만 조용히 빠진다
  });
}
