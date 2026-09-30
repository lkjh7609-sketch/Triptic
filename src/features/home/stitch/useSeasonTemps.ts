import { useQuery } from '@tanstack/react-query';
import type { SeasonCity } from './seasonData';

interface OpenMeteoCurrent {
  current?: { temperature_2m?: number | null; weather_code?: number | null };
}

/** 도시 하나의 지금 날씨 — 기온(℃)과 날씨 코드(WMO, 아이콘용·없으면 null) */
export interface SeasonWeather {
  temp: number;
  code: number | null;
}

/** 여러 도시의 "지금 기온·날씨"를 Open-Meteo(키 없는 무료 예보 API)에서 한 번에 받는다. 실패하면 빈 객체 — 카드에서 기온만 빠진다.
 * 좌표를 쉼표로 이어 보내면 같은 순서의 배열로 돌아온다(한 곳이면 배열이 아니라 객체). */
export async function fetchSeasonTemps(cities: { id: string; lat: number; lng: number }[]): Promise<Record<string, SeasonWeather>> {
  if (cities.length === 0) return {};
  const params = new URLSearchParams({
    latitude: cities.map((c) => c.lat).join(','),
    longitude: cities.map((c) => c.lng).join(','),
    current: 'temperature_2m,weather_code',
    timezone: 'auto',
  });
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
    if (!res.ok) return {};
    const json = (await res.json()) as OpenMeteoCurrent | OpenMeteoCurrent[];
    const rows = Array.isArray(json) ? json : [json];
    const temps: Record<string, SeasonWeather> = {};
    cities.forEach((c, i) => {
      const value = rows[i]?.current?.temperature_2m;
      const code = rows[i]?.current?.weather_code;
      if (typeof value === 'number' && Number.isFinite(value)) temps[c.id] = { temp: value, code: typeof code === 'number' ? code : null };
    });
    return temps;
  } catch {
    return {};
  }
}

/** 결과는 평범한 객체(오프라인 캐시에 JSON으로 저장되므로 Map 금지). 30분 동안 다시 묻지 않는다 */
export function useSeasonTemps(picks: { id: string; city: SeasonCity }[]) {
  const key = picks.map((p) => p.id).join(',');
  return useQuery({
    queryKey: ['seasonTemps', key, 'v2'], // 값 모양이 바뀌었으니 예전 기기 캐시(숫자만 있던 것)는 쓰지 않는다
    queryFn: () => fetchSeasonTemps(picks.map((p) => ({ id: p.id, lat: p.city.lat, lng: p.city.lng }))),
    enabled: picks.length > 0,
    staleTime: 30 * 60 * 1000,
    retry: false,
  });
}
