import { getSupabaseClient } from '@/shared/api/supabaseClient';
import { loadGoogleMapsPlaces } from '@/shared/api/googleMapsLoader';
import type { PlaceCandidate } from './googleLinkMatch';
import type { LinkTarget } from './googleLinkRunner';

export interface LinkOverview {
  /** 아직 구글 장소 ID가 없는 여행지 */
  pending: LinkTarget[];
  linked: number;
  total: number;
}

/** 여행지 전체에서 구글 장소 ID 현황을 읽는다(0079 이후). 컬럼이 아직 없으면 오류가 난다 */
export async function loadLinkOverview(): Promise<LinkOverview> {
  const supabase = getSupabaseClient();
  const { data: rows, error } = await supabase
    .from('destinations')
    .select('id, slug, country_code, lat, lng, google_place_id')
    .order('sort_order');
  if (error) throw error;
  const list = (rows ?? []) as {
    id: string;
    slug: string;
    country_code: string;
    lat: number;
    lng: number;
    google_place_id: string | null;
  }[];
  const { data: names, error: namesError } = await supabase
    .from('destination_translations')
    .select('destination_id, name')
    .eq('locale', 'en');
  if (namesError) throw namesError;
  const nameById = new Map(
    (names ?? []).map((n) => [n.destination_id as string, n.name as string]),
  );
  let regionNames: Intl.DisplayNames | null = null;
  try {
    regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
  } catch {
    regionNames = null;
  }
  const pending = list
    .filter((d) => !d.google_place_id)
    .map((d) => ({
      id: d.id,
      slug: d.slug,
      nameEn: nameById.get(d.id) ?? d.slug,
      countryEn: regionNames?.of(d.country_code) ?? '',
      lat: d.lat,
      lng: d.lng,
    }));
  return { pending, linked: list.length - pending.length, total: list.length };
}

export async function saveGooglePlaceId(destinationId: string, placeId: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('destinations')
    .update({ google_place_id: placeId })
    .eq('id', destinationId);
  if (error) throw error;
}

/** 구글 지도에서 장소 찾기 — 우리 좌표 50km 안을 우선해서 찾는다(관리자 화면에서만 부른다) */
export async function searchGooglePlaces(
  query: string,
  center: { lat: number; lng: number },
): Promise<PlaceCandidate[]> {
  await loadGoogleMapsPlaces();
  const service = new google.maps.places.PlacesService(document.createElement('div'));
  return new Promise((resolve, reject) => {
    service.textSearch(
      { query, location: new google.maps.LatLng(center.lat, center.lng), radius: 50_000 },
      (results, status) => {
        const S = google.maps.places.PlacesServiceStatus;
        if (status === S.ZERO_RESULTS) return resolve([]);
        if (status !== S.OK || !results) return reject(new Error(String(status)));
        resolve(
          results
            .filter((r) => r.place_id && r.geometry?.location)
            .map((r) => ({
              placeId: r.place_id as string,
              name: r.name ?? '',
              lat: r.geometry!.location!.lat(),
              lng: r.geometry!.location!.lng(),
              types: r.types ?? [],
            })),
        );
      },
    );
  });
}
