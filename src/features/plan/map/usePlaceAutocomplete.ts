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

export function usePlaceAutocomplete(onSelect: (place: SelectedPlace) => void) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    let cancelled = false;
    let autocomplete: google.maps.places.Autocomplete | null = null;

    loadGoogleMapsPlaces().then(() => {
      if (cancelled || !inputRef.current) return;
      autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
        fields: ['name', 'formatted_address', 'geometry', 'place_id', 'types'],
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
  }, []);

  return { inputRef, ready };
}
