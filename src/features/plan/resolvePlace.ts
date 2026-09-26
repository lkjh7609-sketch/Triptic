import { loadGoogleMapsPlaces } from '@/shared/api/googleMapsLoader';

export interface ResolvedPlace {
  placeId: string | null;
  name: string;
  lat: number;
  lng: number;
  address: string;
  types: string[];
}

/**
 * 장소 이름(텍스트) → Google 실제 좌표. AI 추천처럼 이름만 있는 장소를 일정에
 * 넣기 전에 쓴다. 서버의 Places 웹 서비스는 브라우저 전용(리퍼러 제한) 키로는
 * 호출할 수 없어서(api/recommend.js 참고) 브라우저의 Maps JS PlacesService를 쓴다.
 * 못 찾거나 오류면 null.
 */
export async function resolvePlace(
  query: string,
  bias?: { lat: number; lng: number } | null,
): Promise<ResolvedPlace | null> {
  const { PlacesService } = await loadGoogleMapsPlaces();
  const service = new PlacesService(document.createElement('div'));
  return new Promise((resolve) => {
    service.findPlaceFromQuery(
      {
        query,
        fields: ['place_id', 'name', 'geometry', 'formatted_address', 'types'],
        ...(bias ? { locationBias: { center: bias, radius: 3000 } } : {}),
      },
      (results, status) => {
        const first = status === google.maps.places.PlacesServiceStatus.OK ? results?.[0] : null;
        const location = first?.geometry?.location;
        if (!first || !location) {
          resolve(null);
          return;
        }
        resolve({
          placeId: first.place_id ?? null,
          name: first.name ?? query,
          lat: location.lat(),
          lng: location.lng(),
          address: first.formatted_address ?? '',
          types: first.types ?? [],
        });
      },
    );
  });
}
