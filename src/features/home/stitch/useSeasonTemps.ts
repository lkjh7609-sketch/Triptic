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

// ── 마지막으로 잘 받은 값 — 이 기기 localStorage에 기한 없이 남겨 둔다(오프라인·서비스 장애·캐시 만료에도 홈에서 기온이 사라지지 않게)
const LAST_GOOD_KEY = 'triptic-season-weather-v1';

export function readLastGood(): Record<string, SeasonWeather> {
  try {
    const parsed = JSON.parse(localStorage.getItem(LAST_GOOD_KEY) ?? '{}') as Record<string, Partial<SeasonWeather>>;
    const out: Record<string, SeasonWeather> = {};
    for (const [id, w] of Object.entries(parsed)) {
      if (typeof w?.temp === 'number' && Number.isFinite(w.temp)) out[id] = { temp: w.temp, code: typeof w.code === 'number' ? w.code : null };
    }
    return out;
  } catch {
    return {};
  }
}

function writeLastGood(values: Record<string, SeasonWeather>) {
  try {
    localStorage.setItem(LAST_GOOD_KEY, JSON.stringify(values));
  } catch {
    // 저장이 막힌 환경(사생활 보호 모드 등) — 없어도 화면은 동작한다
  }
}

function pick(values: Record<string, SeasonWeather>, ids: string[]): Record<string, SeasonWeather> {
  const out: Record<string, SeasonWeather> = {};
  for (const id of ids) if (values[id]) out[id] = values[id];
  return out;
}

/**
 * 새로 받은 값을 "마지막으로 잘 받은 값"과 합친다 — 이번에 빠진 도시는 이전 값을 그대로 둔다.
 * 새 값이 있는 도시만 덮어쓴다(받지 못한 것 때문에 이전 값이 지워지지 않는다).
 */
export function mergeWeather(previous: Record<string, SeasonWeather>, fresh: Record<string, SeasonWeather>): Record<string, SeasonWeather> {
  return { ...previous, ...fresh };
}

/**
 * 결과는 평범한 객체(오프라인 캐시에 JSON으로 저장되므로 Map 금지). 30분 동안 다시 묻지 않는다.
 * 받지 못해도 홈에서 기온이 빠지지 않는다: ① 쿼리는 실패해도 이전 data를 그대로 들고 있고(빈 값으로 덮지 않음),
 * ② 처음 열 때 캐시가 없으면 마지막으로 잘 받은 값(localStorage)으로 시작하며, ③ 실패하면 잠시 뒤 다시 시도한다.
 */
export function useSeasonTemps(picks: { id: string; city: SeasonCity }[], { retry = 2 }: { retry?: number | false } = {}) {
  const ids = picks.map((p) => p.id);
  const key = ids.join(',');
  return useQuery({
    queryKey: ['seasonTemps', key, 'v2'], // 값 모양이 바뀌었으니 예전 기기 캐시(숫자만 있던 것)는 쓰지 않는다
    queryFn: async () => {
      const fresh = await fetchSeasonTemps(picks.map((p) => ({ id: p.id, lat: p.city.lat, lng: p.city.lng })));
      const merged = mergeWeather(readLastGood(), fresh);
      writeLastGood(merged);
      return pick(merged, ids);
    },
    enabled: picks.length > 0,
    staleTime: 30 * 60 * 1000,
    retry,
    retryDelay: (attempt) => Math.min(30_000, 2_000 * 2 ** attempt),
    // 캐시가 없을 때의 시작 값 — updatedAt 0이라 곧바로 새로 받아 오되, 그 요청이 실패해도 이 값은 남는다
    initialData: () => {
      const last = pick(readLastGood(), ids);
      return Object.keys(last).length > 0 ? last : undefined;
    },
    initialDataUpdatedAt: 0,
  });
}
