import { getAccessToken } from '@/shared/api/authToken';
import { apiUrl } from '@/shared/api/apiUrl';
import { aiLocale } from '@/shared/api/aiCacheKeys';
import type { SelectedPlace } from './usePlaceAutocomplete';

interface Bias {
  lat: number | null;
  lng: number | null;
}

type ServerResult =
  | { results: SelectedPlace[]; source: string; limited?: boolean }
  | { unavailable: true };

/** 이번 접속 동안 같은 검색은 서버도 부르지 않는다 */
const memo = new Map<string, SelectedPlace[]>();

/**
 * 서버(api/recommend mode=placeSearch) — 캐시 → 우리 장소 풀 → 구글 Text Search(하루 한도) 순.
 * @returns 결과 목록, 서버가 구글을 못 부르는 상태면 'unavailable', 로그인 전이면 null(검색 안 함)
 */
export async function searchPlacesOnServer(
  q: string,
  bias: Bias | null | undefined,
  language: string,
): Promise<SelectedPlace[] | 'unavailable' | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const locale = aiLocale(language);
  const key = `${locale}|${bias?.lat?.toFixed(1) ?? ''}|${bias?.lng?.toFixed(1) ?? ''}|${q.toLowerCase()}`;
  const hit = memo.get(key);
  if (hit) return hit;
  const res = await fetch(apiUrl('/api/recommend'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ mode: 'placeSearch', q, lat: bias?.lat ?? undefined, lng: bias?.lng ?? undefined, locale }),
  });
  if (!res.ok) return 'unavailable';
  const json = (await res.json()) as ServerResult;
  if ('unavailable' in json) return 'unavailable';
  if (!json.limited) memo.set(key, json.results);
  return json.results;
}
