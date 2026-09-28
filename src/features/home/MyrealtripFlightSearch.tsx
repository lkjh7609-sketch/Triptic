import { useEffect, useId, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { addDays, format } from 'date-fns';
import { ArrowLeftRight, ExternalLink, Search } from 'lucide-react';
import { aiLocale } from '@/shared/api/aiCacheKeys';
import { captureError } from '@/shared/monitoring';
import { fetchMyrealtripFlightsLink, openInNewTab } from '@/features/plan/partnerLinks';
import { PoweredBy } from '@/shared/ui/PoweredBy';
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

function placeLabel(place: Place | null): string {
  return place ? `${place.name} (${place.code})` : '';
}

/** 주소로 받은 코드(여행에서 넘어온 검색) — 이름은 몰라서 코드만 보여준다 */
function placeFromParam(value: string | null): Place | null {
  const code = value?.toUpperCase() ?? '';
  return IATA.test(code) ? { code, type: 'city', name: code, detail: null } : null;
}

function PlaceField({ label, value, onChange, locale }: { label: string; value: Place | null; onChange: (p: Place) => void; locale: string }) {
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

/**
 * 항공 탭(한국어) — 마이리얼트립 항공권 검색. 결과는 마이리얼트립 사이트(새 탭)에서 열린다.
 * 여행에서 넘어오면 주소의 origin/destination/depart_date/return_date/adults를 채워 둔다.
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
  const [returnDate, setReturnDate] = useState(() => initialReturn ?? format(addDays(new Date(), 17), 'yyyy-MM-dd'));
  const [adults, setAdults] = useState(() => {
    const n = Number(searchParams.get('adults'));
    return Number.isInteger(n) && n >= 1 && n <= 9 ? n : 1;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!effectiveOrigin || !destination || effectiveOrigin.code === destination.code) {
      setError(t('flights.form.needPlaces'));
      return;
    }
    if (departDate < today || (roundTrip && returnDate < departDate)) {
      setError(t('flights.form.badDates'));
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
        <div className={styles.places}>
          <PlaceField label={t('flights.form.from')} value={effectiveOrigin} onChange={setOrigin} locale={placesLocale} />
          <button type="button" className={styles.swap} onClick={swap} aria-label={t('flights.form.swap')}>
            <ArrowLeftRight size={16} aria-hidden="true" />
          </button>
          <PlaceField label={t('flights.form.to')} value={destination} onChange={setDestination} locale={placesLocale} />
        </div>
        <div className={styles.dates}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t('flights.form.depart')}</span>
            <input
              type="date"
              className={styles.input}
              value={departDate}
              min={today}
              required
              onChange={(e) => {
                setDepartDate(e.target.value);
                if (returnDate < e.target.value) setReturnDate(e.target.value);
              }}
            />
          </label>
          {roundTrip ? (
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t('flights.form.return')}</span>
              <input type="date" className={styles.input} value={returnDate} min={departDate} required onChange={(e) => setReturnDate(e.target.value)} />
            </label>
          ) : null}
          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t('flights.form.adults')}</span>
            <select className={styles.input} value={adults} onChange={(e) => setAdults(Number(e.target.value))}>
              {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {t('flights.form.adultsCount', { count: n })}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button type="submit" className={styles.submit} disabled={busy}>
          <Search size={18} aria-hidden="true" /> {busy ? t('flights.form.searching') : t('flights.form.search')}
        </button>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
      <div className={styles.footer}>
        <p className={styles.note}>
          <ExternalLink size={12} aria-hidden="true" /> {t('flights.form.opensOnMyrealtrip')}
        </p>
        <PoweredBy brand="myrealtrip" />
      </div>
    </form>
  );
}
