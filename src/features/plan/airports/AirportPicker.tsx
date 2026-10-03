import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { airportSubtitle, airportTitle, searchAirports, type Airport } from './airportData';
import styles from './AirportPicker.module.css';

/** 고른 공항(또는 예전에 Google로 입력해 둔 공항 — iata가 비어 있음) */
export interface SelectedAirport {
  iata: string;
  name: string;
  lat: number | null;
  lng: number | null;
}

interface AirportPickerProps {
  airports: readonly Airport[];
  value: SelectedAirport | null;
  onSelect: (airport: SelectedAirport | null) => void;
  placeholder: string;
  inputRef?: React.Ref<HTMLInputElement>;
  /** 목록에 없을 때 "추가 요청" 누름 */
  onRequest: (query: string) => void;
}

/** 항공편 공항 선택 — 목록(우리 공항 표)에서만 고른다. 입력하면 도시·공항·코드로 찾아 주고, 도시(국가) 아래 작은 글씨로 코드·공항 이름을 보여 준다 */
export function AirportPicker({
  airports,
  value,
  onSelect,
  placeholder,
  inputRef,
  onRequest,
}: AirportPickerProps) {
  const { t, i18n } = useTranslation('plan');
  const listId = useId();
  const [text, setText] = useState(value?.name ?? '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const lastValue = useRef(value);

  // 바깥에서 값이 바뀌면(삭제·다시 열기) 입력 글자도 맞춘다
  useEffect(() => {
    if (lastValue.current !== value) {
      lastValue.current = value;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setText(value?.name ?? '');
    }
  }, [value]);

  const countryName = useMemo(() => {
    let names: Intl.DisplayNames | null = null;
    try {
      names = new Intl.DisplayNames([i18n.language], { type: 'region' });
    } catch {
      names = null;
    }
    return (code: string) => names?.of(code) ?? code;
  }, [i18n.language]);

  const results = useMemo(
    () => searchAirports(airports, text, { countryName }),
    [airports, text, countryName],
  );
  const showList = open && text.trim().length > 0;

  function choose(a: Airport) {
    const name = `${airportTitle(a, i18n.language, countryName)} ${a.iata}`;
    setText(name);
    setOpen(false);
    lastValue.current = { iata: a.iata, name, lat: a.lat, lng: a.lng };
    onSelect(lastValue.current);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showList) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <input
        ref={inputRef}
        className={styles.input}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          showList && results[active] ? `${listId}-${results[active].iata}` : undefined
        }
        autoComplete="off"
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setActive(0);
          setOpen(true);
          // 글자를 고치는 순간 이전 선택은 풀린다 — 목록에서 다시 골라야 한다
          if (value) {
            lastValue.current = null;
            onSelect(null);
          }
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
      />
      {showList ? (
        <ul id={listId} role="listbox" className={styles.list}>
          {results.map((a, i) => (
            <li
              key={a.iata}
              id={`${listId}-${a.iata}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? styles.optionOn : styles.option}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(a);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className={styles.title}>{airportTitle(a, i18n.language, countryName)}</span>
              <span className={styles.sub}>{airportSubtitle(a, i18n.language)}</span>
            </li>
          ))}
          {results.length === 0 ? (
            <li className={styles.empty} role="presentation">
              <span>{t('flight.airportNone')}</span>
              <button
                type="button"
                className={styles.request}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onRequest(text.trim())}
              >
                {t('flight.airportRequest')}
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
