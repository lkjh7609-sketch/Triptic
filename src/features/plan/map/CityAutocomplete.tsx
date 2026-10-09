import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { loadGoogleMapsPlaces } from '@/shared/api/googleMapsLoader';
import { cityDisplayName } from '../cityName';
import { buildCityOptions } from './cityPredictions';
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
  /** 도시 말고 함께 보여 줄 항목(호텔 이름 등) — 목록 맨 위에 붙는다. 없으면 도시만 */
  extraSearch?: (text: string, signal: AbortSignal) => Promise<ExtraOption[]>;
  /** 추가 항목을 고르면 onSelect(그 장소)와 함께 불린다 */
  onSelectExtra?: (option: ExtraOption | null) => void;
}

/** 도시 목록 위에 붙는 추가 항목 한 줄 */
export interface ExtraOption {
  key: string;
  title: string;
  detail?: string;
  /** 줄 앞의 작은 표시(예: '호텔') */
  badge?: string;
  place: SelectedPlace;
}

const DEBOUNCE_MS = 200;

/** 입력칸에 보일 글자 — 도시는 행정구역 접미사를 뗀 이름, 추가 항목(호텔 등)으로 고른 장소는 이름 그대로 */
function shownText(place: SelectedPlace): string {
  return place.placeId?.startsWith('agoda:') ? place.name : cityDisplayName(place.address || place.name);
}

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
  extraSearch,
  onSelectExtra,
}: CityAutocompleteProps) {
  const { i18n } = useTranslation();
  const listId = useId();
  const [text, setText] = useState(
    value ? shownText(value) : initialText,
  );
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [extras, setExtras] = useState<ExtraOption[]>([]);
  const extraAbort = useRef<AbortController | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const lastValue = useRef(value);
  const options = useMemo(
    () => buildCityOptions(predictions, i18n.language),
    [predictions, i18n.language],
  );
  const requestId = useRef(0);
  const token = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  // 바깥에서 값이 바뀌면(도시 채널에서 들어온 자동 입력 등) 글자도 맞춘다
  useEffect(() => {
    if (lastValue.current !== value) {
      lastValue.current = value;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (value) setText(shownText(value));
    }
  }, [value]);

  function onType(next: string) {
    setText(next);
    setActive(0);
    setOpen(true);
    if (value) {
      lastValue.current = null;
      onSelect(null); // 글자를 고치면 이전 선택은 풀린다
      onSelectExtra?.(null);
    }
    const id = ++requestId.current;
    extraAbort.current?.abort();
    if (!next.trim()) {
      setPredictions([]);
      setExtras([]);
      return;
    }
    window.setTimeout(async () => {
      if (id !== requestId.current) return; // 그 사이 더 새 입력이 있었다
      if (extraSearch) {
        const ac = new AbortController();
        extraAbort.current = ac;
        extraSearch(next, ac.signal)
          .then((list) => {
            if (id === requestId.current) setExtras(list);
          })
          .catch(() => {
            if (id === requestId.current) setExtras([]);
          });
      }
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

  function chooseExtra(option: ExtraOption) {
    setText(option.title);
    setOpen(false);
    lastValue.current = option.place;
    onSelect(option.place);
    onSelectExtra?.(option);
  }

  async function choose(prediction: google.maps.places.AutocompletePrediction) {
    onSelectExtra?.(null);
    setText(options.find((o) => o.placeId === prediction.place_id)?.name ?? prediction.description);
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
            name: place.name || prediction.description,
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

  // 목록 = 추가 항목(호텔 등) 먼저, 그다음 도시
  const total = extras.length + predictions.length;
  function pick(index: number) {
    if (index < extras.length) chooseExtra(extras[index]);
    else void choose(predictions[index - extras.length]);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || total === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, total - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault(); // 폼이 제출되지 않게
      pick(Math.min(active, total - 1));
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const showList = open && total > 0;
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
          {extras.map((o, i) => (
            // 한 줄: [표시] 이름 · 부가 설명(도시 등)
            <li
              key={o.key}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? listStyles.optionOn : listStyles.option}
              onMouseDown={(e) => {
                e.preventDefault();
                chooseExtra(o);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className={listStyles.title}>
                {o.badge ? <span className={listStyles.badge}>{o.badge}</span> : null} {o.title}
              </span>
              {o.detail ? <span className={listStyles.sub}>{o.detail}</span> : null}
            </li>
          ))}
          {predictions.map((p, j) => {
            const i = extras.length + j;
            return (
              // 한 줄: 도시(나라)
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
                <span className={listStyles.title}>{options[j]?.label ?? p.description}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
