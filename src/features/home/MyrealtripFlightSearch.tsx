import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type Ref } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { addDays, format, parseISO } from 'date-fns';
import { ArrowLeftRight, CalendarDays, ExternalLink, Minus, Plus, Search } from 'lucide-react';
import { aiLocale } from '@/shared/api/aiCacheKeys';
import { captureError } from '@/shared/monitoring';
import {
  fetchMyrealtripFlightsLink,
  flightLinkParams,
  openExternal,
  openInNewTab,
  useMyrealtripLink,
  type FlightSearch,
} from '@/features/plan/partnerLinks';
import { CalendarRangePicker } from '@/shared/ui/CalendarRangePicker';
import { clearInvalid, flagInvalid } from '@/shared/ui/invalidField';
import styles from './MyrealtripFlightSearch.module.css';

/** 출발지·도착지 하나 — 도시 코드(SEL)와 공항 코드(ICN)를 구분한다(마이리얼트립 주소의 C./A.) */
interface Place {
  code: string;
  type: 'city' | 'airport';
  name: string;
  detail: string | null;
}

interface Places2Row {
  code?: unknown;
  type?: unknown;
  name?: unknown;
  city_name?: unknown;
  country_name?: unknown;
}

const IATA = /^[A-Z]{3}$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** Travelpayouts places2(무료·키 없음) — 도시와 공항을 같이 찾는다 */
async function searchPlaces(term: string, locale: string): Promise<Place[]> {
  const params = new URLSearchParams({ term, locale });
  params.append('types[]', 'city');
  params.append('types[]', 'airport');
  const res = await fetch(`https://autocomplete.travelpayouts.com/places2?${params.toString()}`);
  if (!res.ok) return [];
  const rows = (await res.json()) as Places2Row[];
  const text = (v: unknown) => (typeof v === 'string' && v ? v : null);
  return rows
    .filter((r) => typeof r.code === 'string' && IATA.test(r.code.toUpperCase()) && (r.type === 'city' || r.type === 'airport') && text(r.name))
    .slice(0, 8)
    .map((r) => ({
      code: (r.code as string).toUpperCase(),
      type: r.type as Place['type'],
      name: r.name as string,
      detail: r.type === 'airport' ? [text(r.city_name), text(r.country_name)].filter(Boolean).join(', ') || null : text(r.country_name),
    }));
}

/** 접속 위치에서 가까운 도시(출발지 기본값) */
async function nearestCity(locale: string): Promise<Place | null> {
  const res = await fetch(`https://www.travelpayouts.com/whereami?locale=${locale}`);
  if (!res.ok) return null;
  const json = (await res.json()) as { iata?: unknown; name?: unknown; country_name?: unknown };
  if (typeof json.iata !== 'string' || !IATA.test(json.iata.toUpperCase())) return null;
  const code = json.iata.toUpperCase();
  return {
    code,
    type: 'city',
    name: typeof json.name === 'string' && json.name ? json.name : code,
    detail: typeof json.country_name === 'string' ? json.country_name : null,
  };
}

/** 10월 12일 / Oct 12 — 날짜 칸 한 줄에 가는 날·오는 날이 다 들어가게 짧게 */
function formatDay(ymd: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(parseISO(ymd));
}

function placeLabel(place: Place | null): string {
  return place ? `${place.name} (${place.code})` : '';
}

/** 주소로 받은 코드(여행에서 넘어온 검색) — 이름은 몰라서 코드만 보여준다 */
function placeFromParam(value: string | null): Place | null {
  const code = value?.toUpperCase() ?? '';
  return IATA.test(code) ? { code, type: 'city', name: code, detail: null } : null;
}

function PlaceField({ label, value, onChange, locale, inputRef }: { label: string; value: Place | null; onChange: (p: Place) => void; locale: string; inputRef?: Ref<HTMLInputElement> }) {
  const { t } = useTranslation('home');
  const listId = useId();
  // 입력 중일 때만 글자를 따로 들고, 아니면 고른 곳 이름을 보여준다
  const [editing, setEditing] = useState<string | null>(null);
  const [term, setTerm] = useState('');
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = window.setTimeout(() => setTerm((editing ?? '').trim()), 250);
    return () => window.clearTimeout(id);
  }, [editing]);

  const { data: options = [] } = useQuery({
    queryKey: ['places2', locale, term.toLowerCase()],
    queryFn: () => searchPlaces(term, locale),
    enabled: editing !== null && term.length > 0,
    staleTime: Infinity,
    retry: false,
  });
  const open = editing !== null && term.length > 0 && options.length > 0;

  function pick(place: Place) {
    onChange(place);
    setEditing(null);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(options[Math.min(active, options.length - 1)]);
    } else if (e.key === 'Escape') {
      setEditing(null);
    }
  }

  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <input
        ref={inputRef}
        className={styles.input}
        value={editing ?? placeLabel(value)}
        placeholder={t('flights.form.placePlaceholder')}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        onFocus={(e) => {
          setEditing(placeLabel(value));
          setActive(0);
          e.currentTarget.select();
        }}
        onChange={(e) => {
          setEditing(e.target.value);
          setActive(0);
        }}
        onBlur={() => setEditing(null)}
        onKeyDown={handleKeyDown}
      />
      {open ? (
        <ul id={listId} role="listbox" className={styles.options}>
          {options.map((o, i) => (
            <li
              key={`${o.type}-${o.code}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? styles.optionActive : styles.option}
              // 입력칸 blur보다 먼저 골라야 해서 mousedown
              onMouseDown={(e) => {
                e.preventDefault();
                pick(o);
              }}
            >
              <span className={styles.optionName}>
                {o.name} <span className={styles.optionCode}>{o.code}</span>
              </span>
              <span className={styles.optionDetail}>
                {o.type === 'airport' ? t('flights.form.airport') : t('flights.form.allAirports')}
                {o.detail ? ` · ${o.detail}` : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </label>
  );
}

/** 좌석은 한 번에 9석(성인+아동), 유아(좌석 없음)는 성인 1명당 1명 — 서버 parseFlightQuery와 같은 규칙 */
const MAX_SEATS = 9;

function PassengerStepper({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  const { t } = useTranslation('home');
  return (
    <div className={styles.passenger}>
      <span className={styles.passengerText}>
        <span className={styles.passengerLabel}>{label}</span>
        <span className={styles.passengerHint}>{hint}</span>
      </span>
      <span className={styles.stepper}>
        <button
          type="button"
          className={styles.stepButton}
          disabled={value <= min}
          aria-label={t('flights.form.decrease', { label })}
          onClick={() => onChange(value - 1)}
        >
          <Minus size={14} aria-hidden="true" />
        </button>
        <span className={styles.stepValue} aria-live="polite">
          {value}
        </span>
        <button
          type="button"
          className={styles.stepButton}
          disabled={value >= max}
          aria-label={t('flights.form.increase', { label })}
          onClick={() => onChange(value + 1)}
        >
          <Plus size={14} aria-hidden="true" />
        </button>
      </span>
    </div>
  );
}

/**
 * 항공 탭(한국어) — 마이리얼트립 항공권 검색. 결과는 마이리얼트립 사이트(새 탭)에서 열린다.
 * 여행에서 넘어오면 주소의 origin/destination/depart_date/return_date/adults/children/infants를 채워 둔다.
 */
export function MyrealtripFlightSearch() {
  const { t, i18n } = useTranslation('home');
  const [searchParams] = useSearchParams();
  const placesLocale = aiLocale(i18n.language) === 'ko' ? 'ko' : 'en';
  const today = format(new Date(), 'yyyy-MM-dd');

  const paramDate = (key: string) => {
    const v = searchParams.get(key);
    return v && YMD.test(v) && v >= today ? v : null;
  };
  const initialDepart = paramDate('depart_date');
  const initialReturn = paramDate('return_date');

  const [origin, setOrigin] = useState<Place | null>(() => placeFromParam(searchParams.get('origin')));
  const [destination, setDestination] = useState<Place | null>(() => placeFromParam(searchParams.get('destination')));
  const [roundTrip, setRoundTrip] = useState(() => !initialDepart || !!initialReturn);
  const [departDate, setDepartDate] = useState(() => initialDepart ?? format(addDays(new Date(), 14), 'yyyy-MM-dd'));
  // 캘린더에서 가는 날만 고른 상태면 ''(오는 날 고르는 중)
  const [returnDate, setReturnDate] = useState(() => initialReturn ?? format(addDays(new Date(), 17), 'yyyy-MM-dd'));
  const [showCalendar, setShowCalendar] = useState(false);
  const paramCount = (key: string, min: number, fallback: number) => {
    const n = Number(searchParams.get(key));
    return searchParams.get(key) !== null && Number.isInteger(n) && n >= min && n <= MAX_SEATS ? n : fallback;
  };
  const [adults, setAdults] = useState(() => paramCount('adults', 1, 1));
  const [children, setChildren] = useState(() => Math.min(paramCount('children', 0, 0), MAX_SEATS - adults));
  const [infants, setInfants] = useState(() => Math.min(paramCount('infants', 0, 0), adults));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const originInputRef = useRef<HTMLInputElement>(null);
  const destInputRef = useRef<HTMLInputElement>(null);
  const dateButtonRef = useRef<HTMLButtonElement>(null);

  // 출발지를 안 넘겨받았으면 접속 위치의 도시로
  const { data: here } = useQuery({
    queryKey: ['whereami', placesLocale],
    queryFn: () => nearestCity(placesLocale),
    enabled: !searchParams.get('origin'),
    staleTime: Infinity,
    retry: false,
  });
  const effectiveOrigin = origin ?? here ?? null;

  function swap() {
    setOrigin(destination);
    setDestination(effectiveOrigin);
  }

  // 폼이 다 채워지고 잠깐 멈추면 마이링크를 미리 받아 둔다(만드는 데 최대 2초) — 검색을 누르면 바로 열리게
  const flight: FlightSearch | null =
    effectiveOrigin && destination && effectiveOrigin.code !== destination.code && departDate >= today && (!roundTrip || (returnDate !== '' && returnDate >= departDate))
      ? {
          origin: effectiveOrigin.code,
          originType: effectiveOrigin.type,
          destination: destination.code,
          destinationType: destination.type,
          departDate,
          returnDate: roundTrip ? returnDate : null,
          adults,
          children,
          infants,
        }
      : null;
  const flightKey = flight ? JSON.stringify(flight) : '';
  const [settledKey, setSettledKey] = useState('');
  useEffect(() => {
    const id = window.setTimeout(() => setSettledKey(flightKey), 700);
    return () => window.clearTimeout(id);
  }, [flightKey]);
  const prefetched = useMyrealtripLink(flight && settledKey === flightKey ? flightLinkParams(flight, 'flights') : null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!effectiveOrigin || !destination || effectiveOrigin.code === destination.code) {
      setError(t('flights.form.needPlaces'));
      flagInvalid(!effectiveOrigin ? originInputRef.current : null, !destination || effectiveOrigin?.code === destination.code ? destInputRef.current : null);
      return;
    }
    if (departDate < today || (roundTrip && (returnDate === '' || returnDate < departDate))) {
      setError(t('flights.form.badDates'));
      flagInvalid(dateButtonRef.current);
      return;
    }
    if (prefetched) {
      openExternal(prefetched);
      return;
    }
    setBusy(true);
    try {
      const opened = await openInNewTab(() =>
        fetchMyrealtripFlightsLink(
          {
            origin: effectiveOrigin.code,
            originType: effectiveOrigin.type,
            destination: destination.code,
            destinationType: destination.type,
            departDate,
            returnDate: roundTrip ? returnDate : null,
            adults,
            children,
            infants,
          },
          'flights',
        ),
      );
      if (!opened) setError(t('flights.form.linkError'));
    } catch (err) {
      captureError(err, { context: 'myrealtripFlights' });
      setError(t('flights.form.linkError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.card} onSubmit={handleSubmit}>
      <div className={styles.tripType} role="group" aria-label={t('flights.form.tripType')}>
        <button type="button" aria-pressed={roundTrip} className={roundTrip ? styles.tripOn : styles.tripOff} onClick={() => setRoundTrip(true)}>
          {t('flights.form.roundTrip')}
        </button>
        <button type="button" aria-pressed={!roundTrip} className={!roundTrip ? styles.tripOn : styles.tripOff} onClick={() => setRoundTrip(false)}>
          {t('flights.form.oneWay')}
        </button>
      </div>

      <div className={styles.grid}>
        {/* 출발지·도착지 / 가는 날·오는 날을 선으로 나눈 큰 칸 하나 */}
        <div className={styles.route}>
          <div className={styles.places}>
            <PlaceField label={t('flights.form.from')} value={effectiveOrigin} onChange={setOrigin} locale={placesLocale} inputRef={originInputRef} />
            <button type="button" className={styles.swap} onClick={swap} aria-label={t('flights.form.swap')}>
              <ArrowLeftRight size={16} aria-hidden="true" />
            </button>
            <PlaceField label={t('flights.form.to')} value={destination} onChange={setDestination} locale={placesLocale} inputRef={destInputRef} />
          </div>
          <div className={styles.dates} style={{ gridTemplateColumns: `repeat(${roundTrip ? 2 : 1}, minmax(0, 1fr))` }}>
            <button ref={dateButtonRef} type="button" className={styles.dateCell} onClick={() => setShowCalendar(true)}>
              <span className={styles.fieldLabel}>{t('flights.form.depart')}</span>
              <span className={styles.dateValue}>
                <CalendarDays size={16} aria-hidden="true" className={styles.dateIcon} />
                <span className={styles.dateText}>{formatDay(departDate, i18n.language)}</span>
              </span>
            </button>
            {roundTrip ? (
              <button type="button" className={styles.dateCell} onClick={() => setShowCalendar(true)}>
                <span className={styles.fieldLabel}>{t('flights.form.return')}</span>
                <span className={styles.dateValue}>
                  <CalendarDays size={16} aria-hidden="true" className={styles.dateIcon} />
                  <span className={`${styles.dateText} ${returnDate ? '' : styles.datePlaceholder}`}>
                    {returnDate ? formatDay(returnDate, i18n.language) : t('flights.form.pickReturn')}
                  </span>
                </span>
              </button>
            ) : null}
          </div>
        </div>
        <div className={styles.passengers} role="group" aria-label={t('flights.form.passengers')}>
          <span className={styles.fieldLabel}>{t('flights.form.passengers')}</span>
          <div className={styles.passengerList}>
            <PassengerStepper
              label={t('flights.form.adult')}
              hint={t('flights.form.adultHint')}
              value={adults}
              min={1}
              max={MAX_SEATS - children}
              onChange={(n) => {
                setAdults(n);
                if (infants > n) setInfants(n);
              }}
            />
            <PassengerStepper
              label={t('flights.form.child')}
              hint={t('flights.form.childHint')}
              value={children}
              min={0}
              max={MAX_SEATS - adults}
              onChange={setChildren}
            />
            <PassengerStepper
              label={t('flights.form.infant')}
              hint={t('flights.form.infantHint')}
              value={infants}
              min={0}
              max={adults}
              onChange={setInfants}
            />
          </div>
        </div>
        <button type="submit" className={styles.submit} disabled={busy}>
          <Search size={18} aria-hidden="true" /> {busy ? t('flights.form.searching') : t('flights.form.search')}
        </button>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      {showCalendar ? (
        <div className={styles.calendarOverlay}>
          <div
            className={styles.calendarSheet}
            role="dialog"
            aria-modal="true"
            aria-label={roundTrip ? t('flights.form.dates') : t('flights.form.depart')}
            onClick={(e) => e.stopPropagation()}
          >
            <CalendarRangePicker
              startDate={parseISO(departDate)}
              endDate={roundTrip && returnDate ? parseISO(returnDate) : null}
              onChange={(start, end) => {
                if (!start) return;
                clearInvalid(dateButtonRef.current);
                setDepartDate(format(start, 'yyyy-MM-dd'));
                if (!roundTrip) {
                  setShowCalendar(false);
                  return;
                }
                setReturnDate(end ? format(end, 'yyyy-MM-dd') : '');
                if (end) window.setTimeout(() => setShowCalendar(false), 250);
              }}
            />
            <div className={styles.calendarActions}>
              <button type="button" className={styles.submit} onClick={() => setShowCalendar(false)}>
                {t('action.confirm', { ns: 'common' })}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <p className={styles.note}>
        <ExternalLink size={12} aria-hidden="true" /> {t('flights.form.opensOnMyrealtrip')}
      </p>
    </form>
  );
}
