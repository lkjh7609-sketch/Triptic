/**
 * Google Places 자동완성 (02-screens.md §3.4 "Google Places Autocomplete, 세션 토큰 사용")
 * 위젯형 google.maps.places.Autocomplete는 place_changed로 상세 정보를 가져올 때
 * 세션 토큰을 내부적으로 자동 관리한다 — 프로그래매틱 AutocompleteService처럼
 * 토큰을 직접 만들 필요가 없다. legacy 앱의 hotelAutocomplete와 동일한 방식.
 */
import { useEffect, useRef, useState } from 'react';
import { loadGoogleMapsPlaces } from '@/shared/api/googleMapsLoader';

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
  /** 여행 도시 중심 — 있으면 그 도시 주변(약 30km) 안의 결과만 나온다. 없으면 제한 없음 */
  bias?: { lat: number | null; lng: number | null } | null;
}

const BIAS_RADIUS_KM = 30;

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

    return () => {
      cancelled = true;
      autocompleteRef.current = null;
      if (autocomplete) google.maps.event.clearInstanceListeners(autocomplete);
    };
    // types는 onSelect처럼 이 훅을 쓰는 컴포넌트 생애주기 동안 값이 바뀌지 않는 정적
    // 옵션이므로 마운트 시점 값만 쓰고 재구독하지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { inputRef, ready };
}
