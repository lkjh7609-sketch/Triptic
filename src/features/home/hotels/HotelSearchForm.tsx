import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { Building2, CalendarDays, ChevronDown, MapPin, Minus, Plane, Plus, Search, Users } from 'lucide-react';
import { PoweredByKayak } from '@/features/kayak/PoweredByKayak';
import { fetchHotelPlaces, type HotelPlaceItem } from '@/features/kayak/kayakApi';
import { CalendarRangePicker } from '@/shared/ui/CalendarRangePicker';
import { clearInvalid, flagInvalid } from '@/shared/ui/invalidField';
import { MAX_ADULTS, MAX_CHILDREN, MAX_ROOMS, defaultDates, nightsBetween, type HotelSearch } from './hotelSearch';
import styles from './HotelSearchForm.module.css';

interface Destination {
  key: string;
  name: string;
}

function placeIcon(kind: string) {
  if (kind === 'hotel') return <Building2 size={16} aria-hidden="true" />;
  if (kind === 'airport') return <Plane size={16} aria-hidden="true" />;
  return <MapPin size={16} aria-hidden="true" />;
}

function DestinationField({ value, onPick, inputRef }: { value: Destination | null; onPick: (d: Destination) => void; inputRef: React.Ref<HTMLInputElement> }) {
  const { t } = useTranslation('home');
  const listId = useId();
  const [editing, setEditing] = useState<string | null>(null);
  const [term, setTerm] = useState('');
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = window.setTimeout(() => setTerm((editing ?? '').trim()), 250);
    return () => window.clearTimeout(id);
  }, [editing]);

  const { data } = useQuery({
    queryKey: ['kayakPlaces', 'hotels', term.toLowerCase()],
    queryFn: ({ signal }) => fetchHotelPlaces(term, signal),
    enabled: editing !== null && term.length > 0,
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
  const options: HotelPlaceItem[] = term.length > 0 ? (data?.items ?? []) : [];
  const open = editing !== null && options.length > 0;

  function pick(o: HotelPlaceItem) {
    onPick({ key: o.key, name: o.name });
    setEditing(null);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
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
      <span className={styles.label}>{t('hotels.form.destination')}</span>
      <span className={styles.inputWrap}>
        <MapPin size={18} className={styles.inputIcon} aria-hidden="true" />
        <input
          ref={inputRef}
          className={styles.input}
          value={editing ?? value?.name ?? ''}
          placeholder={t('hotels.form.destinationPlaceholder')}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          onFocus={(e) => {
            setEditing(value?.name ?? '');
            setActive(0);
            e.currentTarget.select();
          }}
          onChange={(e) => {
            setEditing(e.target.value);
            setActive(0);
          }}
          onBlur={() => setEditing(null)}
          onKeyDown={onKeyDown}
        />
      </span>
      {open ? (
        <ul id={listId} role="listbox" className={styles.options}>
          {options.map((o, i) => (
            <li
              key={o.key}
              role="option"
              aria-selected={i === active}
              className={i === active ? styles.optionActive : styles.option}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(o);
              }}
            >
              <span className={styles.optionIcon}>{placeIcon(o.kind)}</span>
              <span className={styles.optionText}>
                <span className={styles.optionName}>{o.name}</span>
                {o.detail ? <span className={styles.optionDetail}>{o.detail}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </label>
  );
}

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  const { t } = useTranslation('home');
  return (
    <div className={styles.stepRow}>
      <span className={styles.stepLabel}>{label}</span>
      <span className={styles.stepper}>
        <button type="button" className={styles.stepButton} disabled={value <= min} aria-label={t('hotels.form.decrease', { label })} onClick={() => onChange(value - 1)}>
          <Minus size={14} aria-hidden="true" />
        </button>
        <span className={styles.stepValue} aria-live="polite">
          {value}
        </span>
        <button type="button" className={styles.stepButton} disabled={value >= max} aria-label={t('hotels.form.increase', { label })} onClick={() => onChange(value + 1)}>
          <Plus size={14} aria-hidden="true" />
        </button>
      </span>
    </div>
  );
}

interface Guests {
  rooms: number;
  adults: number;
  childAges: number[];
}

function GuestsPicker({ value, onChange }: { value: Guests; onChange: (g: Guests) => void }) {
  const { t } = useTranslation('home');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const summary = [t('hotels.form.roomsN', { count: value.rooms }), t('hotels.form.guestsN', { count: value.adults + value.childAges.length })].join(' · ');

  return (
    <div ref={rootRef} className={styles.field}>
      <span className={styles.label}>{t('hotels.form.guests')}</span>
      <button type="button" className={styles.cellButton} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={() => setOpen((o) => !o)}>
        <Users size={18} className={styles.inputIcon} aria-hidden="true" />
        <span className={styles.cellText}>{summary}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open ? (
        <div id={panelId} role="dialog" aria-label={t('hotels.form.guests')} className={styles.popover}>
          <Stepper label={t('hotels.form.rooms')} value={value.rooms} min={1} max={Math.min(MAX_ROOMS, value.adults)} onChange={(rooms) => onChange({ ...value, rooms })} />
          <Stepper
            label={t('hotels.form.adults')}
            value={value.adults}
            min={value.rooms}
            max={MAX_ADULTS}
            onChange={(adults) => onChange({ ...value, adults })}
          />
          <Stepper
            label={t('hotels.form.children')}
            value={value.childAges.length}
            min={0}
            max={MAX_CHILDREN}
            onChange={(n) => onChange({ ...value, childAges: n > value.childAges.length ? [...value.childAges, 8] : value.childAges.slice(0, n) })}
          />
          {value.childAges.map((age, i) => (
            <label key={i} className={styles.ageRow}>
              <span>{t('hotels.form.childAge', { n: i + 1 })}</span>
              <select
                className={styles.select}
                value={age}
                onChange={(e) => onChange({ ...value, childAges: value.childAges.map((a, j) => (j === i ? Number(e.target.value) : a)) })}
              >
                {Array.from({ length: 18 }, (_, a) => (
                  <option key={a} value={a}>
                    {t('hotels.form.ageN', { count: a })}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <button type="button" className={styles.done} onClick={() => setOpen(false)}>
            {t('action.confirm', { ns: 'common' })}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function formatDay(ymd: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', weekday: 'short' }).format(parseISO(ymd));
}

/** 호텔 검색폼 — 목적지(Kayak 자동완성)·날짜(우리 달력)·객실/인원. 검색하면 onSearch로 조건을 넘긴다 */
export function HotelSearchForm({ initial, busy, onSearch }: { initial: HotelSearch | null; busy: boolean; onSearch: (s: HotelSearch) => void }) {
  const { t, i18n } = useTranslation('home');
  const [destination, setDestination] = useState<Destination | null>(initial ? { key: initial.destination, name: initial.name || initial.destination } : null);
  const [dates, setDates] = useState(() => (initial ? { checkin: initial.checkin, checkout: initial.checkout } : defaultDates()));
  const [guests, setGuests] = useState<Guests>(() => ({ rooms: initial?.rooms ?? 1, adults: initial?.adults ?? 2, childAges: initial?.childAges ?? [] }));
  const [showCalendar, setShowCalendar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const destRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLButtonElement>(null);
  const today = format(new Date(), 'yyyy-MM-dd');

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!destination) {
      setError(t('hotels.form.needDestination'));
      flagInvalid(destRef.current);
      return;
    }
    if (!dates.checkin || !dates.checkout || dates.checkin < today || dates.checkout <= dates.checkin) {
      setError(t('hotels.form.badDates'));
      flagInvalid(dateRef.current);
      return;
    }
    onSearch({ destination: destination.key, name: destination.name, checkin: dates.checkin, checkout: dates.checkout, ...guests });
  }

  const nights = dates.checkout > dates.checkin ? nightsBetween(dates.checkin, dates.checkout) : 0;

  return (
    <form className={styles.card} onSubmit={submit}>
      <div className={styles.grid}>
        <DestinationField value={destination} onPick={setDestination} inputRef={destRef} />
        <div className={styles.field}>
          <span className={styles.label}>{t('hotels.form.dates')}</span>
          <button ref={dateRef} type="button" className={styles.cellButton} onClick={() => setShowCalendar(true)}>
            <CalendarDays size={18} className={styles.inputIcon} aria-hidden="true" />
            <span className={styles.cellText}>
              {formatDay(dates.checkin, i18n.language)}
              {' – '}
              {dates.checkout ? formatDay(dates.checkout, i18n.language) : <span className={styles.placeholder}>{t('hotels.form.pickCheckout')}</span>}
              {nights > 0 ? <span className={styles.nights}>{t('hotels.form.nightsN', { count: nights })}</span> : null}
            </span>
          </button>
        </div>
        <GuestsPicker value={guests} onChange={setGuests} />
        <button type="submit" className={styles.submit} disabled={busy}>
          <Search size={18} aria-hidden="true" /> {busy ? t('hotels.form.searching') : t('hotels.form.search')}
        </button>
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
      <div className={styles.poweredRow}>
        <PoweredByKayak />
      </div>

      {showCalendar ? (
        <div className={styles.calendarOverlay}>
          <div className={styles.calendarSheet} role="dialog" aria-modal="true" aria-label={t('hotels.form.dates')}>
            <CalendarRangePicker
              startDate={parseISO(dates.checkin)}
              endDate={dates.checkout ? parseISO(dates.checkout) : null}
              onChange={(start, end) => {
                if (!start) return;
                clearInvalid(dateRef.current);
                setDates({ checkin: format(start, 'yyyy-MM-dd'), checkout: end ? format(end, 'yyyy-MM-dd') : '' });
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
    </form>
  );
}
