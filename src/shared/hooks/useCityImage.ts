import { useMemo } from 'react';
import { useDestinations } from '@/features/community/hooks/useDestinations';
import type { Destination } from '@/features/community/types';

/**
 * 도시 대표 이미지 — **우리 도시 목록(DB destinations.cover_url, 300곳)의 사진만** 쓴다(사용자 결정 2026-10-17).
 * 여행 좌표로 60km 안 가장 가까운 도시(PDF 표지와 같은 규칙), 좌표가 없거나 멀면 도시 이름·slug로 찾는다.
 * 목록에 없는 도시는 정해 둔 기본 여행 사진(도시 이름으로 늘 같은 한 장).
 * 예전에는 코드에 박은 사진 목록과 위키백과에서 새로 불러왔는데, 한국어 위키백과 '호치민'(인물 호찌민) 사진이 여행 카드에 나왔다.
 */
const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1473625247510-8ceb1760943f?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80',
];

/** 목록에 없는 도시 — 도시 이름으로 늘 같은 기본 사진 한 장 */
export function fallbackCityImage(city: string): string {
  let hash = 0;
  for (let i = 0; i < city.length; i++) {
    hash = city.charCodeAt(i) + ((hash << 5) - hash);
  }
  return FALLBACK_IMAGES[Math.abs(hash) % FALLBACK_IMAGES.length];
}

type CoverDest = Pick<Destination, 'name' | 'slug' | 'lat' | 'lng' | 'cover_url'>;

/** 이름 비교용 — 소문자, 공백·기호 제거, 한국어 끝의 '시'(호치민시) 제거 */
function normName(v: string): string {
  return v.toLowerCase().replace(/[\s\-_.·'’()]/g, '').replace(/(?<=[가-힣]{2})시$/, '');  // i18n-exempt: 도시 이름 비교용 접미사
}

/**
 * DB 도시 목록에서 이 도시의 사진. 좌표가 있으면 60km 안 가장 가까운 도시, 없거나 멀면 이름(현재 언어 이름·slug)으로.
 * 못 찾으면 null.
 */
export function destinationCover(city: string, at: { lat?: number | null; lng?: number | null } | undefined, list: readonly CoverDest[] | undefined): string | null {
  if (!list?.length) return null;
  if (typeof at?.lat === 'number' && typeof at?.lng === 'number' && !(at.lat === 0 && at.lng === 0)) {
    const k = Math.cos((at.lat * Math.PI) / 180);
    let best: { url: string; km: number } | null = null;
    for (const d of list) {
      if (!d.cover_url) continue;
      const km = Math.hypot((d.lat - at.lat) * 111.32, (d.lng - at.lng) * 111.32 * k);
      if (!best || km < best.km) best = { url: d.cover_url, km };
    }
    if (best && best.km <= 60) return best.url;
  }
  const want = normName(city.split(',')[0] ?? '');
  if (!want) return null;
  const hit = list.find((d) => d.cover_url && (normName(d.name) === want || normName(d.slug) === want));
  return hit?.cover_url ?? null;
}

/** at: 여행 도시 좌표(있으면 DB 도시를 좌표로 찾는다 — 화면 언어와 저장된 도시 이름 언어가 달라도 맞는다) */
export function useCityImage(city: string | null | undefined, at?: { lat?: number | null; lng?: number | null }): string {
  const key = (city ?? '').trim();
  const destinations = useDestinations();
  const lat = at?.lat ?? null;
  const lng = at?.lng ?? null;
  return useMemo(
    () => (key ? destinationCover(key, { lat, lng }, destinations.data) : null) ?? (key ? fallbackCityImage(key) : FALLBACK_IMAGES[0]),
    [key, lat, lng, destinations.data],
  );
}
