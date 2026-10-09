import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { CalendarDays, ChevronDown, Minus, Plus, Search, Users } from 'lucide-react';
import { CityAutocomplete, type ExtraOption } from '@/features/plan/map/CityAutocomplete';
import type { SelectedPlace } from '@/features/plan/map/usePlaceAutocomplete';
import { CalendarRangePicker } from '@/shared/ui/CalendarRangePicker';
import { clearInvalid, flagInvalid } from '@/shared/ui/invalidField';
import { MAX_ADULTS, MAX_CHILDREN, defaultDates, nightsBetween, type HotelSearch } from './hotelSearch';
import { hotelLang, suggestHotels } from './hotelsApi';
import styles from './HotelSearchForm.module.css';

/** 나라 이름(표시 언어) — 호텔 자동완성 한 줄의 작은 글씨 */
function countryName(code: string | null, language: string): string {
  if (!code) return '';
  try {
    return new Intl.DisplayNames([language], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/**
 * 목적지 — 호텔 이름(우리 색인, 위) + 도시(구글 자동완성, 아래)를 한 칸에서 고른다.
 * 도시를 고르면 그 좌표에서 가장 가까운 도시를, 호텔을 고르면 그 호텔(맨 위 고정)과 같은 도시 추천을 검색한다.
 */
function DestinationField({
  value,
  onPick,
  onPickHotel,
  inputRef,
}: {
  value: SelectedPlace | null;
  onPick: (p: SelectedPlace | null) => void;
  onPickHotel: (hotelId: number | null) => void;
  inputRef: React.Ref<HTMLInputElement>;
}) {
  const { t, i18n } = useTranslation('home');
  const lang = hotelLang(i18n.language);
  const extraSearch = useCallback(
    async (text: string, signal: AbortSignal): Promise<ExtraOption[]> => {
      const list = await suggestHotels(text, lang, signal);
      return list
        .filter((h) => h.lat !== null && h.lng !== null)
        .map((h) => ({
          key: `hotel-${h.id}`,
          title: h.name,
          detail: [lang === 'ko' ? h.city : null, countryName(h.country, i18n.language)].filter(Boolean).join(', '),
          badge: t('hotels.form.hotelBadge'),
          place: { name: h.name, address: h.name, lat: h.lat as number, lng: h.lng as number, placeId: `agoda:${h.id}`, types: ['lodging'], countryCode: h.country ?? undefined },
        }));
    },
    [lang, i18n.language, t],
  );
  return (
    <div className={styles.field}>
      <span className={styles.label}>{t('hotels.form.destination')}</span>
      <span className={styles.inputWrap}>
        <CityAutocomplete
          value={value}
          onSelect={onPick}
          extraSearch={extraSearch}
          onSelectExtra={(o) => onPickHotel(o ? Number(o.key.slice('hotel-'.length)) : null)}
          placeholder={t('hotels.form.destinationPlaceholder')}
          className={styles.input}
          inputRef={inputRef}
        />
      </span>
    </div>
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

  const summary = t('hotels.form.guestsN', { count: value.adults + value.childAges.length });

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
          <Stepper
            label={t('hotels.form.adults')}
            value={value.adults}
            min={1}
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

/** 호텔 검색폼 — 목적지(호텔 이름 또는 도시)·날짜(우리 달력)·인원. 검색하면 onSearch로 조건을 넘긴다 */
export function HotelSearchForm({ initial, busy, onSearch }: { initial: HotelSearch | null; busy: boolean; onSearch: (s: HotelSearch) => void }) {
  const { t, i18n } = useTranslation('home');
  const [destination, setDestination] = useState<SelectedPlace | null>(
    initial ? { name: initial.name, address: initial.name, lat: initial.lat, lng: initial.lng, placeId: initial.hotelId ? `agoda:${initial.hotelId}` : null, types: [] } : null,
  );
  // 호텔 이름으로 고른 경우 그 호텔(아고다 ID)
  const [hotelId, setHotelId] = useState<number | null>(initial?.hotelId ?? null);
  const [dates, setDates] = useState(() => (initial ? { checkin: initial.checkin, checkout: initial.checkout } : defaultDates()));
  const [guests, setGuests] = useState<Guests>(() => ({ adults: initial?.adults ?? 2, childAges: initial?.childAges ?? [] }));
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
    onSearch({
      name: destination.name,
      lat: destination.lat,
      lng: destination.lng,
      checkin: dates.checkin,
      checkout: dates.checkout,
      ...guests,
      ...(hotelId ? { hotelId } : {}),
    });
  }

  const nights = dates.checkout > dates.checkin ? nightsBetween(dates.checkin, dates.checkout) : 0;

  return (
    <form className={styles.card} onSubmit={submit}>
      <div className={styles.grid}>
        <DestinationField value={destination} onPick={setDestination} onPickHotel={setHotelId} inputRef={destRef} />
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
