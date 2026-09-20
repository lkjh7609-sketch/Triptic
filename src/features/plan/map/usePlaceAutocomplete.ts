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
}

export interface UsePlaceAutocompleteOptions {
  /** Google Places Autocomplete의 types 제한 (예: 도시만 검색하려면 ['(cities)']) */
  types?: string[];
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

  useEffect(() => {
    let cancelled = false;
    let autocomplete: google.maps.places.Autocomplete | null = null;

    loadGoogleMapsPlaces().then(() => {
      if (cancelled || !inputRef.current) return;
      autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
        fields: ['name', 'formatted_address', 'geometry', 'place_id', 'types'],
        ...(types ? { types } : {}),
      });
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
        });
      });
      setReady(true);
    });

    return () => {
      cancelled = true;
      if (autocomplete) google.maps.event.clearInstanceListeners(autocomplete);
    };
    // types는 onSelect처럼 이 훅을 쓰는 컴포넌트 생애주기 동안 값이 바뀌지 않는 정적
    // 옵션이므로 마운트 시점 값만 쓰고 재구독하지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { inputRef, ready };
}
