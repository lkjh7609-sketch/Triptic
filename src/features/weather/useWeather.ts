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
): Promise<WeatherResponse> {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng), start, end, lang: 'ko' });
  const res = await fetch(apiUrl(`/api/weather?${params.toString()}`));
  // §6.3 "실패: 아무것도 표시하지 않는다. 에러 토스트도 띄우지 않는다" — 화면은 data가 없으면 조용히
  // 생략한다. 실패를 null '성공'으로 돌려주면 그 값이 30분 동안(오프라인 캐시에는 24시간) 정상 결과로
  // 남아 서버가 살아난 뒤에도 날씨가 안 보이므로, 실패는 throw해 캐시에 남지 않게 한다.
  if (!res.ok) throw new Error(`weather ${res.status}`);
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
    // 'v2': 실패를 null로 저장하던 때의 오프라인 캐시 항목이 새 조회와 섞이지 않게 키를 바꿈
    queryKey: ['weather', 'v2', enabled ? gridKey(lat, lng) : null, start, end],
    queryFn: () => fetchWeather(lat as number, lng as number, start as string, end as string),
    enabled,
    staleTime: 30 * 60 * 1000, // §3.3 클라이언트 캐시 30분
    retry: false, // 재시도 스톰 방지 — 실패는 그냥 실패로 둔다
  });
}
