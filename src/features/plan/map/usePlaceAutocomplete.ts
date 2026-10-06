/**
 * Google Places 자동완성 (02-screens.md §3.4 "Google Places Autocomplete, 세션 토큰 사용")
 * 위젯형 google.maps.places.Autocomplete는 place_changed로 상세 정보를 가져올 때
 * 세션 토큰을 내부적으로 자동 관리한다 — 프로그래매틱 AutocompleteService처럼
 * 토큰을 직접 만들 필요가 없다. legacy 앱의 hotelAutocomplete와 동일한 방식.
 */
import { useEffect, useRef, useState } from 'react';
import { loadGoogleMapsPlaces } from '@/shared/api/googleMapsLoader';
import i18n from '@/shared/i18n';
import { searchPlacesOnServer } from './placeSearchApi';

export interface SelectedPlace {
  name: string;
  address: string;
  lat: number;
  lng: number;
  placeId: string | null;
  types: string[];
  /** ISO 3166-1 alpha-2 (예: "JP") — 여행 통화 자동 지정용. 모르면 null */
  countryCode?: string | null;
}

export function countryCodeOf(components: google.maps.GeocoderAddressComponent[] | undefined): string | null {
  return components?.find((c) => c.types.includes('country'))?.short_name ?? null;
}

export interface UsePlaceAutocompleteOptions {
  /** Google Places Autocomplete의 types 제한 (예: 도시만 검색하려면 ['(cities)']) */
  types?: string[];
  /** false면 Google 스크립트를 부르지 않는다(항공편 공항처럼 목록으로 대신하는 칸) — 기본 true */
  enabled?: boolean;
  /** 여행 도시 중심 — 있으면 그 도시 주변(약 200km, 근교 여행지까지) 안의 결과만 나온다. 없으면 제한 없음 */
  bias?: { lat: number | null; lng: number | null } | null;
  /** true면 자동완성 결과가 0개일 때 Text Search로 한 번 더 찾아 아래 목록으로 보여 준다("동물원"처럼 이름이 아닌 종류로 찾을 때) */
  textSearchFallback?: boolean;
}

/** 서버가 구글을 못 부르는 상태(서버 키 없음 등)일 때만 쓰는 브라우저 직접 검색 */
async function searchInBrowser(q: string, bias: { lat: number | null; lng: number | null }): Promise<SelectedPlace[]> {
  const { Place } = await loadGoogleMapsPlaces();
  const { lat, lng } = bias;
  const { places } = await Place.searchByText({
    textQuery: q,
    fields: ['displayName', 'formattedAddress', 'location', 'id', 'types', 'addressComponents'],
    maxResultCount: 6,
    ...(lat != null && lng != null ? { locationRestriction: boundsAround(lat, lng) } : {}),
  });
  return places
    .filter((pl) => pl.location)
    .map((pl) => ({
      name: pl.displayName ?? pl.formattedAddress ?? '',
      address: pl.formattedAddress ?? '',
      lat: pl.location!.lat(),
      lng: pl.location!.lng(),
      placeId: pl.id ?? null,
      types: pl.types ?? [],
      countryCode: pl.addressComponents?.find((c) => c.types.includes('country'))?.shortText ?? null,
    }));
}

/** 입력을 멈춘 뒤 이만큼 기다렸다가 자동완성 목록이 비었는지 본다(자동완성이 먼저 응답할 시간) */
const FALLBACK_DELAY_MS = 700;
/** 이 글자 수 미만이면 보조 검색을 하지 않는다 */
const FALLBACK_MIN_CHARS = 2;

const BIAS_RADIUS_KM = 200;

function boundsAround(lat: number, lng: number): google.maps.LatLngBoundsLiteral {
  const dLat = BIAS_RADIUS_KM / 111;
  const dLng = BIAS_RADIUS_KM / (111 * Math.max(Math.cos((lat * Math.PI) / 180), 0.1));
  return { south: lat - dLat, north: lat + dLat, west: lng - dLng, east: lng + dLng };
}

export function usePlaceAutocomplete(
  onSelect: (place: SelectedPlace) => void,
  options?: UsePlaceAutocompleteOptions,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);
  const types = options?.types;
  const enabled = options?.enabled ?? true;
  const fallbackOn = options?.textSearchFallback ?? false;
  const [fallbackItems, setFallbackItems] = useState<SelectedPlace[]>([]);
  const biasLat = options?.bias?.lat ?? null;
  const biasLng = options?.bias?.lng ?? null;
  const biasRef = useRef({ lat: biasLat, lng: biasLng });
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  // 도시가 바뀌면(호텔 모달에서 날짜 탭 전환 등) 이미 만든 자동완성의 범위만 갈아 끼운다
  useEffect(() => {
    biasRef.current = { lat: biasLat, lng: biasLng };
    const ac = autocompleteRef.current;
    if (ac && biasLat != null && biasLng != null) {
      ac.setBounds(boundsAround(biasLat, biasLng));
      ac.setOptions({ strictBounds: true });
    }
  }, [biasLat, biasLng]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let autocomplete: google.maps.places.Autocomplete | null = null;

    loadGoogleMapsPlaces().then(() => {
      if (cancelled || !inputRef.current) return;
      autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
        fields: ['name', 'formatted_address', 'geometry', 'place_id', 'types', 'address_components'],
        ...(types ? { types } : {}),
        ...(biasRef.current.lat != null && biasRef.current.lng != null
          ? { bounds: boundsAround(biasRef.current.lat, biasRef.current.lng), strictBounds: true }
          : {}),
      });
      autocompleteRef.current = autocomplete;
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete!.getPlace();
        if (!place.geometry?.location) return;
        onSelectRef.current({
          name: place.name || place.formatted_address || '',
          address: place.formatted_address || '',
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          placeId: place.place_id ?? null,
          types: place.types ?? [],
          countryCode: countryCodeOf(place.address_components),
        });
      });
      setReady(true);
    });

    // 자동완성 목록이 비어 있으면(보이는 .pac-item이 없으면) Text Search로 보충한다 — 별도 자동완성 호출 없이 화면만 본다
    const input = inputRef.current;
    let timer: number | undefined;
    let seq = 0;
    const onInput = () => {
      window.clearTimeout(timer);
      const q = input?.value.trim() ?? '';
      seq += 1;
      const mySeq = seq;
      if (!fallbackOn || q.length < FALLBACK_MIN_CHARS) {
        setFallbackItems([]);
        return;
      }
      timer = window.setTimeout(async () => {
        const hasPac = [...document.querySelectorAll('.pac-container')].some(
          (c) => getComputedStyle(c).display !== 'none' && c.querySelector('.pac-item'),
        );
        if (hasPac) {
          setFallbackItems([]);
          return;
        }
        try {
          const bias = biasRef.current;
          // 서버(캐시 → 우리 장소 풀 → 구글, 하루 한도)가 먼저 — 로그인 전이면 보조 검색을 하지 않는다
          const server = await searchPlacesOnServer(q, bias, i18n.language);
          if (mySeq !== seq) return;
          if (server === null) {
            setFallbackItems([]);
            return;
          }
          setFallbackItems(server === 'unavailable' ? await searchInBrowser(q, bias) : server);
        } catch {
          // 네트워크·구글 오류 — 보조 검색만 포기하고 자동완성은 그대로 둔다
          if (mySeq === seq) setFallbackItems([]);
        }
      }, FALLBACK_DELAY_MS);
    };
    input?.addEventListener('input', onInput);

    return () => {
      window.clearTimeout(timer);
      input?.removeEventListener('input', onInput);
      cancelled = true;
      autocompleteRef.current = null;
      if (autocomplete) google.maps.event.clearInstanceListeners(autocomplete);
    };
    // types는 onSelect처럼 이 훅을 쓰는 컴포넌트 생애주기 동안 값이 바뀌지 않는 정적
    // 옵션이므로 마운트 시점 값만 쓰고 재구독하지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const fallback = {
    items: fallbackItems,
    pick: (place: SelectedPlace) => {
      if (inputRef.current) inputRef.current.value = place.name;
      setFallbackItems([]);
      onSelectRef.current(place);
    },
    clear: () => setFallbackItems([]),
  };

  return { inputRef, ready, fallback };
}
