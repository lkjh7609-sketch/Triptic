import { useEffect, useId, useRef, useState } from 'react';
import { loadGoogleMapsPlaces } from '@/shared/api/googleMapsLoader';
import { cityDisplayName } from '../cityName';
import { cityPredictionLabel, cityPredictionName } from './cityPredictions';
import { countryCodeOf, type SelectedPlace } from './usePlaceAutocomplete';
import listStyles from '../airports/AirportPicker.module.css';

interface CityAutocompleteProps {
  id?: string;
  /** 고른 도시(바깥에서 채워질 수도 있다 — 도시 채널에서 '일정 만들기'로 들어온 경우) */
  value: SelectedPlace | null;
  onSelect: (place: SelectedPlace | null) => void;
  placeholder: string;
  className?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  /** 처음 보여 줄 글자(고른 도시가 아직 확인되지 않았을 때) */
  initialText?: string;
}

const DEBOUNCE_MS = 200;

/**
 * 여행 만들기의 도시 입력 — 구글 도시 자동완성(types: (cities))을 쓰되 목록은 우리가 그린다:
 * 한 줄에 "도시(나라)"만 보인다. 고르면 예전 위젯과 같은 모양(SelectedPlace)으로 알려 준다.
 */
export function CityAutocomplete({
  id,
  value,
  onSelect,
  placeholder,
  className,
  inputRef,
  initialText = '',
}: CityAutocompleteProps) {
  const listId = useId();
  const [text, setText] = useState(
    value ? cityDisplayName(value.address || value.name) : initialText,
  );
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const lastValue = useRef(value);
  const requestId = useRef(0);
  const token = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  // 바깥에서 값이 바뀌면(도시 채널에서 들어온 자동 입력 등) 글자도 맞춘다
  useEffect(() => {
    if (lastValue.current !== value) {
      lastValue.current = value;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (value) setText(cityDisplayName(value.address || value.name));
    }
  }, [value]);

  function onType(next: string) {
    setText(next);
    setActive(0);
    setOpen(true);
    if (value) {
      lastValue.current = null;
      onSelect(null); // 글자를 고치면 이전 선택은 풀린다
    }
    const id = ++requestId.current;
    if (!next.trim()) {
      setPredictions([]);
      return;
    }
    window.setTimeout(async () => {
      if (id !== requestId.current) return; // 그 사이 더 새 입력이 있었다
      try {
        await loadGoogleMapsPlaces();
        token.current ??= new google.maps.places.AutocompleteSessionToken();
        const service = new google.maps.places.AutocompleteService();
        service.getPlacePredictions(
          { input: next, types: ['(cities)'], sessionToken: token.current },
          (results) => {
            if (id === requestId.current) setPredictions(results ?? []);
          },
        );
      } catch {
        if (id === requestId.current) setPredictions([]);
      }
    }, DEBOUNCE_MS);
  }

  async function choose(prediction: google.maps.places.AutocompletePrediction) {
    setText(cityPredictionName(prediction));
    setOpen(false);
    try {
      await loadGoogleMapsPlaces();
      const service = new google.maps.places.PlacesService(document.createElement('div'));
      service.getDetails(
        {
          placeId: prediction.place_id,
          fields: [
            'name',
            'formatted_address',
            'geometry',
            'place_id',
            'types',
            'address_components',
          ],
          sessionToken: token.current ?? undefined,
        },
        (place, status) => {
          token.current = null; // 한 번 고르면 세션 끝
          const location = place?.geometry?.location;
          if (status !== google.maps.places.PlacesServiceStatus.OK || !place || !location) return;
          const selected: SelectedPlace = {
            name: place.name || cityPredictionName(prediction),
            address: place.formatted_address || '',
            lat: location.lat(),
            lng: location.lng(),
            placeId: place.place_id ?? prediction.place_id,
            types: place.types ?? [],
            countryCode: countryCodeOf(place.address_components),
          };
          lastValue.current = selected;
          onSelect(selected);
        },
      );
    } catch {
      /* 구글을 못 불러오면 고르지 못한 채로 둔다 — 제출할 때 도시 선택 안내가 뜬다 */
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || predictions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, predictions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault(); // 폼이 제출되지 않게
      void choose(predictions[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const showList = open && predictions.length > 0;
  return (
    <div style={{ position: 'relative' }}>
      <input
        id={id}
        ref={inputRef}
        className={className}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList ? `${listId}-${active}` : undefined}
        autoComplete="off"
        placeholder={placeholder}
        value={text}
        onChange={(e) => onType(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
      />
      {showList ? (
        <ul id={listId} role="listbox" className={listStyles.list}>
          {predictions.map((p, i) => (
            <li
              key={p.place_id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? listStyles.optionOn : listStyles.option}
              onMouseDown={(e) => {
                e.preventDefault();
                void choose(p);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className={listStyles.title}>{cityPredictionLabel(p)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
