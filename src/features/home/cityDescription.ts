import { getSupabaseClient } from '@/shared/api/supabaseClient';
import { apiUrl } from '@/shared/api/apiUrl';
import { aiLocale, cityDescCacheKey } from '@/shared/api/aiCacheKeys';

export function cityDescQueryKey(city: string, locale: string) {
  return ['ai', 'cityDesc', aiLocale(locale), cityDescCacheKey(city)] as const;
}

/** 이미 누군가 생성해 DB에 저장된 소개만 한 번에(0049) — 홈 진입 시 추천 카드 미리 채우기용.
 * 캐시 키 → 소개 문구(평범한 객체, 오프라인 캐시에 JSON으로 저장되므로 Map 금지). 실패하면 빈 결과. */
export async function readCachedCityDescriptions(cities: string[], locale: string): Promise<Record<string, string>> {
  const { data, error } = await getSupabaseClient().rpc('get_city_descriptions', {
    p_city_keys: cities.map(cityDescCacheKey),
    p_locale: aiLocale(locale),
  });
  if (error) return {};
  const byKey: Record<string, string> = {};
  for (const row of (data ?? []) as { city_key: string; description: string | null }[]) {
    if (row.description) byKey[row.city_key] = row.description;
  }
  return byKey;
}

/** 1) DB 캐시(0049) → 2) 없을 때만 /api/cityDesc(LLM으로 한 번 생성하고 서버가 DB에 영구 저장) */
export async function fetchCityDescription(city: string, locale: string): Promise<string | null> {
  try {
    const { data, error } = await getSupabaseClient().rpc('get_ai_cache', {
      p_kind: 'city_desc',
      p_city_key: cityDescCacheKey(city),
      p_place_key: '',
      p_category: 'all',
      p_locale: aiLocale(locale),
    });
    const description = !error && data && typeof (data as { description?: unknown }).description === 'string'
      ? (data as { description: string }).description
      : null;
    if (description) return description;
  } catch {
    // RPC 네트워크 오류 등 — 아래 API로 넘어간다
  }
  const res = await fetch(apiUrl(`/api/cityDesc?city=${encodeURIComponent(city)}&locale=${encodeURIComponent(locale)}`));
  if (!res.ok) throw new Error(`cityDesc HTTP ${res.status}`);
  const json = (await res.json()) as { description?: unknown };
  return typeof json.description === 'string' ? json.description : null;
}
