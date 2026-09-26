/**
 * 날씨 조회 훅 (05-weather.md §3)
 * 요청은 항목 단위가 아니라 여행 단위(시작일~종료일)로 한 번만 묶어서 보낸다.
 * 같은 도시(같은 gridKey)로 날짜만 다른 여러 화면이 열려도 TanStack Query가
 * 캐시를 공유해 실제 네트워크 호출은 1회로 줄어든다.
 */
import { useQuery } from '@tanstack/react-query';
import { gridKey } from './gridKey';
import { apiUrl } from '@/shared/api/apiUrl';

export interface WeatherDailyEntry {
  date: string;
  tempMinC: number | null;
  tempMaxC: number | null;
  /** WeatherKit 원본 코드 — 표시 전 conditionMap.mapConditionCode로 압축할 것 */
  conditionCode: string | null;
  precipChance: number | null;
  source: 'forecast' | 'climate_normal';
}

export interface WeatherCurrent {
  tempC: number;
  condition: string;
  conditionCode: string;
  isDaylight: boolean;
}

export interface WeatherHourlyEntry {
  /** ISO 8601 (UTC) */
  time: string;
  tempC: number;
  conditionCode: string;
}

export interface WeatherResponse {
  gridKey: string;
  source: 'forecast' | 'climate_normal' | 'cache';
  fetchedAt: string;
  current: WeatherCurrent | null;
  daily: WeatherDailyEntry[];
  hourly: WeatherHourlyEntry[];
}

async function fetchWeather(
  lat: number,
  lng: number,
  start: string,
  end: string,
): Promise<WeatherResponse | null> {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng), start, end, lang: 'ko' });
  const res = await fetch(apiUrl(`/api/weather?${params.toString()}`));
  // §6.3 "실패: 아무것도 표시하지 않는다. 에러 토스트도 띄우지 않는다" — throw하지 않고
  // null을 돌려줘서 UI가 조용히 날씨 영역을 생략하게 한다(WEATHERKIT_* 미설정 시의
  // 503도 이 경로로 처리된다 — 지금 이 프로젝트의 기본 상태).
  if (!res.ok) return null;
  return res.json();
}

export function useWeather(
  lat: number | null | undefined,
  lng: number | null | undefined,
  start: string | null | undefined,
  end: string | null | undefined,
) {
  const enabled = lat != null && lng != null && !!start && !!end;
  return useQuery({
    queryKey: ['weather', enabled ? gridKey(lat, lng) : null, start, end],
    queryFn: () => fetchWeather(lat as number, lng as number, start as string, end as string),
    enabled,
    staleTime: 30 * 60 * 1000, // §3.3 클라이언트 캐시 30분
    retry: false, // 재시도 스톰 방지 — 실패는 그냥 실패로 둔다
  });
}
