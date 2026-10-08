import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/api/supabaseClient';

/**
 * 등록 도시의 '오늘' 날씨 — 하루 한 번 서버가 WeatherKit에서 받아 destination_weather(0101)에 저장해 둔 값.
 * 홈 "지금 가기 좋은 여행지"와 도시 채널은 외부 날씨 서비스를 직접 부르지 않고 이 표만 읽는다.
 */
export interface DestinationWeather {
  destinationId: string;
  /** 그 도시의 현지 날짜 */
  date: string;
  tmaxC: number | null;
  tminC: number | null;
  /** WeatherKit 원본 날씨 코드 — 화면에서는 conditionMap.mapConditionCode로 줄여 쓴다 */
  conditionCode: string | null;
  /** 0~1 */
  precipChance: number | null;
  updatedAt: string;
}

interface Row {
  destination_id: string;
  date: string;
  tmax_c: number | string | null;
  tmin_c: number | string | null;
  condition_code: string | null;
  precip_chance: number | string | null;
  updated_at: string;
}

/** numeric 열은 문자열로 올 수 있다 */
const num = (v: number | string | null): number | null => {
  if (v === null) return null;
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
};

/** 이 시간보다 오래된 값은 쓰지 않는다 — 하루 한 번 갱신인데 갱신이 멈췄다면 어제 날씨를 오늘처럼 보여 주지 않는다 */
export const MAX_WEATHER_AGE_MS = 36 * 60 * 60 * 1000;

export function toDestinationWeather(row: Row): DestinationWeather {
  return {
    destinationId: row.destination_id,
    date: row.date,
    tmaxC: num(row.tmax_c),
    tminC: num(row.tmin_c),
    conditionCode: row.condition_code,
    precipChance: num(row.precip_chance),
    updatedAt: row.updated_at,
  };
}

export function isFreshWeather(w: Pick<DestinationWeather, 'updatedAt'>, now = Date.now()): boolean {
  const t = Date.parse(w.updatedAt);
  return Number.isFinite(t) && now - t <= MAX_WEATHER_AGE_MS;
}

/** 도시 id들의 오늘 날씨(신선한 것만) — id → 날씨 */
export async function fetchDestinationWeathers(ids: string[]): Promise<Record<string, DestinationWeather>> {
  if (ids.length === 0) return {};
  const { data, error } = await getSupabaseClient().from('destination_weather').select('*').in('destination_id', ids);
  if (error) throw error;
  const out: Record<string, DestinationWeather> = {};
  for (const row of (data as Row[] | null) ?? []) {
    const w = toDestinationWeather(row);
    if (isFreshWeather(w) && (w.tmaxC !== null || w.tminC !== null)) out[w.destinationId] = w;
  }
  return out;
}

/** 여러 도시의 오늘 날씨 — 서버가 하루 한 번만 바꾸니 30분마다 다시 읽는다. 실패하면 날씨 칸만 조용히 빠진다 */
export function useDestinationWeathers(ids: string[]) {
  const key = [...ids].sort().join(',');
  return useQuery({
    queryKey: ['destinationWeather', key],
    queryFn: () => fetchDestinationWeathers(ids),
    enabled: ids.length > 0,
    staleTime: 30 * 60 * 1000,
    retry: false,
  });
}

/** 도시 하나의 오늘 날씨 — 없으면 null */
export function useDestinationWeather(destinationId: string | undefined): DestinationWeather | null {
  const { data } = useDestinationWeathers(destinationId ? [destinationId] : []);
  return (destinationId && data?.[destinationId]) || null;
}
