/**
 * Google Maps JS API 로더 (새 React 앱 전용)
 * 레거시 앱은 <script> 태그를 수동으로 만들어 로드하지만(index.html
 * loadGoogleMaps, 2026-09-20 기준 라인 3278), 새 앱은 공식 로더 패키지의
 * 함수형 API(setOptions/importLibrary — Loader 클래스는 deprecated)로 대체한다.
 * 여러 컴포넌트가 동시에 호출해도 실제 로드는 한 번만 일어나도록 Promise를 캐시한다.
 */
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

let optionsSet = false;
const libraryPromises = new Map<string, Promise<unknown>>();

function ensureOptions(): void {
  if (optionsSet) return;
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error('VITE_GOOGLE_MAPS_API_KEY가 설정되지 않았습니다.');
  }
  setOptions({ key: apiKey });
  optionsSet = true;
}

/** maps 라이브러리(Map, DirectionsService 등)를 로드하고 window.google을 반환한다 */
export async function loadGoogleMaps(): Promise<typeof google> {
  ensureOptions();
  if (!libraryPromises.has('maps')) {
    libraryPromises.set('maps', importLibrary('maps'));
  }
  await libraryPromises.get('maps');
  return google;
}

/** places 라이브러리(Autocomplete 등, 장소 검색에 필요)를 로드한다 */
export async function loadGoogleMapsPlaces(): Promise<google.maps.PlacesLibrary> {
  ensureOptions();
  if (!libraryPromises.has('places')) {
    libraryPromises.set('places', importLibrary('places'));
  }
  return libraryPromises.get('places') as Promise<google.maps.PlacesLibrary>;
}
