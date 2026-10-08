import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode, type Ref } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { addDays, format, parseISO } from 'date-fns';
import { Armchair, ArrowLeftRight, CalendarDays, Check, ChevronDown, History, Minus, PlaneLanding, PlaneTakeoff, Plus, Search, ShieldCheck } from 'lucide-react';
import { captureError } from '@/shared/monitoring';
import {
  fetchMyrealtripFlightsLink,
  flightLinkParams,
  openExternal,
  openInNewTab,
  useMyrealtripLink,
  type FlightSearch,
} from '@/features/plan/partnerLinks';
import { useAirports } from '@/features/plan/airports/useAirports';
import { DEFAULT_ORIGIN_CODE, flightPlaceForCode, searchFlightPlaces, type FlightPlace } from '@/features/plan/airports/flightPlaces';
import { CalendarRangePicker } from '@/shared/ui/CalendarRangePicker';
import { clearInvalid, flagInvalid } from '@/shared/ui/invalidField';
import styles from './MyrealtripFlightSearch.module.css';

/** 출발지·도착지 하나 — 도시 코드(SEL)와 공항 코드(ICN)를 구분한다(마이리얼트립 주소의 C./A.). 우리 공항 목록에서 찾는다 */
type Place = FlightPlace;

const IATA = /^[A-Z]{3}$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** 나라 이름(표시 언어) — 공항 목록 한 줄의 작은 글씨 */
function useCountryName(language: string): (code: string) => string {
  return useMemo(() => {
    let names: Intl.DisplayNames | null = null;
    try {
      names = new Intl.DisplayNames([language], { type: 'region' });
    } catch {
      names = null;
    }
    return (code: string) => names?.of(code) ?? code;
  }, [language]);
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

function PlaceField({
  label,
  value,
  onChange,
  inputRef,
  icon,
}: {
  label: string;
  value: Place | null;
  onChange: (p: Place) => void;
  inputRef?: Ref<HTMLInputElement>;
  /** PC 칸 오른쪽 끝의 작은 아이콘(이륙·착륙) */
  icon?: ReactNode;
}) {
  const { t, i18n } = useTranslation('home');
  const listId = useId();
  const { data: airports = [] } = useAirports();
  const countryName = useCountryName(i18n.language);
  // 입력 중일 때만 글자를 따로 들고, 아니면 고른 곳 이름을 보여준다
  const [editing, setEditing] = useState<string | null>(null);
  const [term, setTerm] = useState('');
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = window.setTimeout(() => setTerm((editing ?? '').trim()), 250);
    return () => window.clearTimeout(id);
  }, [editing]);

  const options: Place[] = useMemo(
    () => (editing !== null && term.length > 0 ? searchFlightPlaces(airports, term, i18n.language, countryName) : []),
    [airports, editing, term, i18n.language, countryName],
  );
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
      {icon ? (
        <span className={styles.fieldIcon} aria-hidden="true">
          {icon}
        </span>
      ) : null}
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

/** 최근 검색(이 기기) — 출발지·도착지만 기억한다. 날짜는 지난 날이 되기 쉬워서 넣지 않는다 */
interface RecentSearch {
  origin: Place;
  destination: Place;
}

const RECENT_KEY = 'triptic-flights-recent';

function isPlace(v: unknown): v is Place {
  const p = v as Place | null;
  return !!p && typeof p.code === 'string' && IATA.test(p.code) && (p.type === 'city' || p.type === 'airport') && typeof p.name === 'string' && p.name.length > 0;
}

function readRecent(): RecentSearch | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) ?? 'null') as { origin?: unknown; destination?: unknown } | null;
    return parsed && isPlace(parsed.origin) && isPlace(parsed.destination) ? { origin: parsed.origin, destination: parsed.destination } : null;
  } catch {
    return null;
  }
}

function saveRecent(origin: Place, destination: Place): RecentSearch {
  const value = { origin, destination };
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(value));
  } catch {
    // 저장 공간이 없거나 막힌 브라우저 — 이번 접속 동안만 보인다
  }
  return value;
}

type Cabin = 'ECONOMY' | 'PREMIUM_ECONOMY' | 'BUSINESS' | 'FIRST';
const CABINS: Cabin[] = ['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'];

/** "성인 1명 · 아동 1명 · 일반석" — 탑승객 요약(칸 값·칩 모두 이 글) */
function passengerSummary(t: (key: string, opts?: Record<string, unknown>) => string, adults: number, children: number, infants: number, cabin: Cabin): string {
  const parts = [t('flights.form.adultN', { n: adults })];
  if (children > 0) parts.push(t('flights.form.childN', { n: children }));
  if (infants > 0) parts.push(t('flights.form.infantN', { n: infants }));
  parts.push(t(`flights.form.cabin${cabin}`));
  return parts.join(' · ');
}

interface PassengerPickerProps {
  adults: number;
  kids: number;
  infants: number;
  cabin: Cabin;
  onAdults: (n: number) => void;
  onChildren: (n: number) => void;
  onInfants: (n: number) => void;
  onCabin: (c: Cabin) => void;
}

/**
 * PC 탑승객·좌석 등급 — 요약 한 칸("성인 1명 · 일반석 ⌄")을 누르면 팝오버에서 인원과 등급을 고른다.
 * 좌석 규칙은 카드 방식(모바일)과 같다: 성인+아동 최대 9석, 유아는 성인 수까지.
 */
function PassengerPicker({ adults, kids, infants, cabin, onAdults, onChildren, onInfants, onCabin }: PassengerPickerProps) {
  const { t } = useTranslation('home');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={styles.picker}>
      <button type="button" className={styles.pickerButton} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={() => setOpen((o) => !o)}>
        <span className={styles.pickerIcon} aria-hidden="true">
          <Armchair size={20} />
        </span>
        <span className={styles.pickerText}>
          <span className={styles.pickerLabel}>{t('flights.form.passengerSummary')}</span>
          <span className={styles.pickerValue}>
            {passengerSummary(t, adults, kids, infants, cabin)}
            <ChevronDown size={16} aria-hidden="true" />
          </span>
        </span>
      </button>
      {open ? (
        <div id={panelId} role="dialog" aria-label={t('flights.form.passengerSummary')} className={styles.popover}>
          <PassengerStepper
            label={t('flights.form.adult')}
            hint={t('flights.form.adultHint')}
            value={adults}
            min={1}
            max={MAX_SEATS - kids}
            onChange={onAdults}
          />
          <PassengerStepper label={t('flights.form.child')} hint={t('flights.form.childHint')} value={kids} min={0} max={MAX_SEATS - adults} onChange={onChildren} />
          <PassengerStepper label={t('flights.form.infant')} hint={t('flights.form.infantHint')} value={infants} min={0} max={adults} onChange={onInfants} />
          <div className={styles.cabinGroup} role="radiogroup" aria-label={t('flights.form.cabinLabel')}>
            <span className={styles.cabinLabel}>{t('flights.form.cabinLabel')}</span>
            {CABINS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={cabin === c} className={cabin === c ? styles.cabinOn : styles.cabinOff} onClick={() => onCabin(c)}>
                {cabin === c ? <Check size={14} aria-hidden="true" /> : null}
                {t(`flights.form.cabin${c}`)}
              </button>
            ))}
          </div>
          <button type="button" className={styles.popoverDone} onClick={() => setOpen(false)}>
            {t('action.confirm', { ns: 'common' })}
          </button>
        </div>
      ) : null}
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
  const [cabin, setCabin] = useState<Cabin>('ECONOMY');
  const [recent, setRecent] = useState<RecentSearch | null>(() => readRecent());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const originInputRef = useRef<HTMLInputElement>(null);
  const destInputRef = useRef<HTMLInputElement>(null);
  const dateButtonRef = useRef<HTMLButtonElement>(null);

  // 공항 목록이 오면 주소로 넘어온 코드(SEL·SYD)에 이름을 붙이고, 출발지를 안 넘겨받았으면 서울(모든 공항)로
  const { data: airports = [] } = useAirports();
  const countryName = useCountryName(i18n.language);
  const named = (p: Place | null) => (p && p.name === p.code ? (flightPlaceForCode(airports, p.code, i18n.language, countryName) ?? p) : p);
  const here = searchParams.get('origin') ? null : flightPlaceForCode(airports, DEFAULT_ORIGIN_CODE, i18n.language, countryName);
  const effectiveOrigin = named(origin) ?? here ?? null;
  const shownDestination = named(destination);

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
          ...(cabin !== 'ECONOMY' ? { cabin } : {}),
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
    setRecent(saveRecent(effectiveOrigin, destination));
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
            ...(cabin !== 'ECONOMY' ? { cabin } : {}),
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
      <div className={styles.topRow}>
        <div className={styles.tripType} role="group" aria-label={t('flights.form.tripType')}>
          <button type="button" aria-pressed={roundTrip} className={roundTrip ? styles.tripOn : styles.tripOff} onClick={() => setRoundTrip(true)}>
            {t('flights.form.roundTrip')}
          </button>
          <button type="button" aria-pressed={!roundTrip} className={!roundTrip ? styles.tripOn : styles.tripOff} onClick={() => setRoundTrip(false)}>
            {t('flights.form.oneWay')}
          </button>
        </div>
        {recent ? (
          <button
            type="button"
            className={styles.recent}
            onClick={() => {
              setOrigin(recent.origin);
              setDestination(recent.destination);
            }}
          >
            <History size={14} aria-hidden="true" />
            {t('flights.form.recent', { route: `${recent.origin.name} ⇄ ${recent.destination.name}` })}
          </button>
        ) : null}
      </div>

      <div className={styles.grid}>
        {/* 출발지·도착지 / 가는 날·오는 날을 선으로 나눈 큰 칸 하나 */}
        <div className={styles.route}>
          <div className={styles.places}>
            <PlaceField
              label={t('flights.form.from')}
              value={effectiveOrigin}
              onChange={setOrigin}
              inputRef={originInputRef}
              icon={<PlaneTakeoff size={20} />}
            />
            <button type="button" className={styles.swap} onClick={swap} aria-label={t('flights.form.swap')}>
              <ArrowLeftRight size={16} aria-hidden="true" />
            </button>
            <PlaceField
              label={t('flights.form.to')}
              value={shownDestination}
              onChange={setDestination}
              inputRef={destInputRef}
              icon={<PlaneLanding size={20} />}
            />
          </div>
          <div className={styles.dates}>
            <button ref={dateButtonRef} type="button" className={styles.dateCell} onClick={() => setShowCalendar(true)}>
              <span className={styles.fieldLabel}>{roundTrip ? t('flights.form.dates') : t('flights.form.depart')}</span>
              <span className={styles.dateValue}>
                <CalendarDays size={16} aria-hidden="true" className={styles.dateIcon} />
                <span className={styles.dateText}>
                  {formatDay(departDate, i18n.language)}
                  {roundTrip ? (
                    <>
                      {' – '}
                      {returnDate ? formatDay(returnDate, i18n.language) : <span className={styles.datePlaceholder}>{t('flights.form.pickReturn')}</span>}
                    </>
                  ) : null}
                </span>
              </span>
            </button>
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
        {/* PC: 탑승객·좌석 등급 요약 칸 + 요약 칩(모바일은 위 카드 3장을 쓴다) */}
        <div className={styles.bottomRow}>
          <PassengerPicker
            adults={adults}
            kids={children}
            infants={infants}
            cabin={cabin}
            onAdults={(n) => {
              setAdults(n);
              if (infants > n) setInfants(n);
            }}
            onChildren={setChildren}
            onInfants={setInfants}
            onCabin={setCabin}
          />
          <span className={styles.chips} aria-hidden="true">
            <span className={styles.chip}>{t('flights.form.adultN', { n: adults })}</span>
            {children > 0 ? <span className={styles.chip}>{t('flights.form.childN', { n: children })}</span> : null}
            {infants > 0 ? <span className={styles.chip}>{t('flights.form.infantN', { n: infants })}</span> : null}
            <span className={styles.chip}>{t(`flights.form.cabin${cabin}`)}</span>
          </span>
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
        <ShieldCheck size={14} aria-hidden="true" /> {t('flights.form.opensOnMyrealtrip')}
      </p>
    </form>
  );
}
