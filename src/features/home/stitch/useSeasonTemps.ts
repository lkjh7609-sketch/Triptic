import { useQuery } from '@tanstack/react-query';
import { fetchKeepingLastGood, lastGoodOptions, readLastGood } from '@/shared/api/lastGood';
import type { SeasonCity } from './seasonData';

interface OpenMeteoCurrent {
  current?: { temperature_2m?: number | null; weather_code?: number | null };
}

/** 도시 하나의 지금 날씨 — 기온(℃)과 날씨 코드(WMO, 아이콘용·없으면 null) */
export interface SeasonWeather {
  temp: number;
  code: number | null;
}

/**
 * 여러 도시의 "지금 기온·날씨"를 Open-Meteo(키 없는 무료 예보 API)에서 한 번에 받는다.
 * 좌표를 쉼표로 이어 보내면 같은 순서의 배열로 돌아온다(한 곳이면 배열이 아니라 객체).
 * 받지 못하면 **빈 값을 돌려주지 않고 오류를 던진다** — 그래야 호출한 쪽이 이전 값을 그대로 들고 있을 수 있다.
 */
export async function fetchSeasonTemps(cities: { id: string; lat: number; lng: number }[]): Promise<Record<string, SeasonWeather>> {
  if (cities.length === 0) return {};
  const params = new URLSearchParams({
    latitude: cities.map((c) => c.lat).join(','),
    longitude: cities.map((c) => c.lng).join(','),
    current: 'temperature_2m,weather_code',
    timezone: 'auto',
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!res.ok) throw new Error(`open-meteo HTTP ${res.status}`);
  const json = (await res.json()) as OpenMeteoCurrent | OpenMeteoCurrent[];
  const rows = Array.isArray(json) ? json : [json];
  const temps: Record<string, SeasonWeather> = {};
  cities.forEach((c, i) => {
    const value = rows[i]?.current?.temperature_2m;
    const code = rows[i]?.current?.weather_code;
    if (typeof value === 'number' && Number.isFinite(value)) temps[c.id] = { temp: value, code: typeof code === 'number' ? code : null };
  });
  return temps;
}

function pick(values: Record<string, SeasonWeather>, ids: string[]): Record<string, SeasonWeather> {
  const out: Record<string, SeasonWeather> = {};
  for (const id of ids) if (values[id]) out[id] = values[id];
  return out;
}

const LAST_GOOD_KEY = 'seasonWeather';

/**
 * 새로 받은 값을 "마지막으로 잘 받은 값"과 합친다 — 이번에 빠진 도시는 이전 값을 그대로 둔다.
 * 새 값이 있는 도시만 덮어쓴다(받지 못한 것 때문에 이전 값이 지워지지 않는다).
 */
export function mergeWeather(previous: Record<string, SeasonWeather> | undefined, fresh: Record<string, SeasonWeather>): Record<string, SeasonWeather> {
  return { ...previous, ...fresh };
}

/**
 * 결과는 평범한 객체(오프라인 캐시에 JSON으로 저장되므로 Map 금지). 30분 동안 다시 묻지 않는다.
 * 받지 못해도 홈에서 기온이 빠지지 않는다 — 마지막으로 잘 받은 값을 3일까지 보여준다(shared/api/lastGood.ts):
 * 실패는 오류로 던져 이전 data를 유지하고, 캐시가 없으면 저장된 값으로 시작하며, 일부 도시만 받아져도 나머지는 이전 값을 유지한다.
 */
export function useSeasonTemps(picks: { id: string; city: SeasonCity }[], { retry = 2 }: { retry?: number | false } = {}) {
  const ids = picks.map((p) => p.id);
  const key = ids.join(',');
  const startValue = () => {
    const last = pick(readLastGood<Record<string, SeasonWeather>>(LAST_GOOD_KEY) ?? {}, ids);
    return Object.keys(last).length > 0 ? last : undefined;
  };
  return useQuery({
    queryKey: ['seasonTemps', key, 'v2'], // 값 모양이 바뀌었으니 예전 기기 캐시(숫자만 있던 것)는 쓰지 않는다
    queryFn: async () => {
      const merged = await fetchKeepingLastGood<Record<string, SeasonWeather>>(
        LAST_GOOD_KEY,
        () => fetchSeasonTemps(picks.map((p) => ({ id: p.id, lat: p.city.lat, lng: p.city.lng }))),
        { isEmpty: (fresh) => Object.keys(fresh).length === 0, merge: mergeWeather },
      );
      return pick(merged, ids);
    },
    enabled: picks.length > 0,
    staleTime: 30 * 60 * 1000,
    retry,
    retryDelay: (attempt) => Math.min(30_000, 2_000 * 2 ** attempt),
    initialData: startValue,
    initialDataUpdatedAt: lastGoodOptions(LAST_GOOD_KEY).initialDataUpdatedAt,
  });
}
