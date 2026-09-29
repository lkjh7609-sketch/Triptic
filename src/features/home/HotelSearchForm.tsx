import { useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { addDays, format, isSameDay, parseISO } from 'date-fns';
import { CalendarDays, ExternalLink, Minus, Plus, Search } from 'lucide-react';
import { useDestinations } from '@/features/community/hooks/useDestinations';
import type { Destination } from '@/features/community/types';
import { openExternal } from '@/features/plan/partnerLinks';
import { CalendarRangePicker } from '@/shared/ui/CalendarRangePicker';
import { clearInvalid, flagInvalid } from '@/shared/ui/invalidField';
import { hotelDestinations, matchDestinations, nearestDestination, nightsBetween } from './hotelSearch';
import { TRIP_HOTEL_CITY_IDS } from './tripHotelCities';
import { tripHotelSearchUrl, tripHotelsHomeUrl } from './tripPartner';
import { useNearestTrip } from './useNearestTrip';
import styles from './HotelSearchForm.module.css';

/** 성인은 객실당 1명 이상 — 객실 수는 성인 수를 넘길 수 없다 */
const MAX_ADULTS = 8;
const MAX_ROOMS = 4;
const YMD = 'yyyy-MM-dd';

/** 10월 12일 / Oct 12 — 날짜 칸 한 줄에 체크인·체크아웃이 다 들어가게 짧게 */
function formatDay(ymd: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(parseISO(ymd));
}

function regionNameFormatter(locale: string): (code: string) => string {
  try {
    const names = new Intl.DisplayNames([locale], { type: 'region' });
    return (code) => names.of(code) ?? code;
  } catch {
    return (code) => code;
  }
}

function DestinationField({
  label,
  placeholder,
  noMatch,
  value,
  onChange,
  options,
  locale,
  inputRef,
}: {
  label: string;
  placeholder: string;
  noMatch: string;
  value: Destination | null;
  onChange: (dest: Destination) => void;
  options: Destination[];
  locale: string;
  inputRef: Ref<HTMLInputElement>;
}) {
  const listId = useId();
  // 입력 중일 때만 글자를 따로 들고, 아니면 고른 여행지 이름을 보여준다
  const [editing, setEditing] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const countryName = useMemo(() => regionNameFormatter(locale), [locale]);

  // 고른 이름 그대로 두고 열었으면(=바꾸려는 게 아직 없으면) 추천 목록을 보여 준다
  const query = editing === null || editing === (value?.name ?? '') ? '' : editing;
  const results = useMemo(
    () => (editing === null ? [] : matchDestinations(options, query, countryName)),
    [editing, options, query, countryName],
  );
  const open = editing !== null;

  function pick(dest: Destination) {
    onChange(dest);
    setEditing(null);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results.length > 0) {
      e.preventDefault();
      pick(results[Math.min(active, results.length - 1)]);
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
        value={editing ?? value?.name ?? ''}
        placeholder={placeholder}
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
        onBlur={() => {
          // 목록에서 안 고르고 이름을 그대로 다 쳤으면 그 여행지로
          const typed = (editing ?? '').trim().toLowerCase();
          const exact = typed ? options.find((d) => d.name.toLowerCase() === typed) : undefined;
          if (exact && exact.id !== value?.id) onChange(exact);
          setEditing(null);
        }}
        onKeyDown={handleKeyDown}
      />
      {open ? (
        <ul id={listId} role="listbox" className={styles.options}>
          {results.length === 0 ? (
            <li className={styles.noMatch} role="presentation">
              {noMatch}
            </li>
          ) : (
            results.map((d, i) => (
              <li
                key={d.id}
                role="option"
                aria-selected={i === active}
                className={i === active ? styles.optionActive : styles.option}
                // 입력칸 blur보다 먼저 골라야 해서 mousedown
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(d);
                }}
              >
                <span className={styles.optionName}>{d.name}</span>
                <span className={styles.optionDetail}>{countryName(d.country_code)}</span>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </label>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  const { t } = useTranslation('home');
  return (
    <div className={styles.field} role="group" aria-label={label}>
      <span className={styles.fieldLabel}>{label}</span>
      <span className={`${styles.input} ${styles.stepper}`}>
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
 * 호텔 탭 검색창 — 여행지·기간·인원을 고르면 트립닷컴 호텔 검색 결과가 새 탭으로 열린다(제휴 링크,
 * tripPartner.ts). 여행지는 트립닷컴 도시 번호가 있는 우리 여행지에서 고른다. 다음 여행이 있으면 그 도시와
 * 기간을 미리 채운다(직접 바꾸면 그쪽이 우선).
 */
export function HotelSearchForm() {
  const { t, i18n } = useTranslation('home');
  const { data: allDestinations } = useDestinations();
  const trip = useNearestTrip();
  const today = format(new Date(), YMD);

  const options = useMemo(() => hotelDestinations(allDestinations ?? []), [allDestinations]);

  // 다음 여행 → 검색창 미리 채움(사용자가 안 건드린 칸만)
  const prefillDest = useMemo(
    () => (trip?.city_lat != null && trip.city_lng != null ? nearestDestination(options, trip.city_lat, trip.city_lng) : null),
    [trip, options],
  );
  const prefillStay =
    trip?.start_date && trip.end_date && trip.start_date >= today && nightsBetween(trip.start_date, trip.end_date) > 0
      ? { checkIn: trip.start_date, checkOut: trip.end_date }
      : null;

  const [pickedDest, setPickedDest] = useState<Destination | null>(null);
  const [pickedIn, setPickedIn] = useState<string | null>(null);
  // '' = 캘린더에서 체크인만 고른 상태(체크아웃 고르는 중)
  const [pickedOut, setPickedOut] = useState<string | null>(null);
  const [adults, setAdults] = useState(2);
  const [rooms, setRooms] = useState(1);
  const [showCalendar, setShowCalendar] = useState(false);
  // 목록에서 도시를 안 골랐는데 검색을 눌렀을 때 — 붉은 테두리만으로는 왜 안 되는지 몰라서 문구로 알려 준다
  const [needCity, setNeedCity] = useState(false);
  const destInputRef = useRef<HTMLInputElement>(null);
  const dateButtonRef = useRef<HTMLButtonElement>(null);

  const dest = pickedDest ?? prefillDest;
  const checkIn = pickedIn ?? prefillStay?.checkIn ?? format(addDays(new Date(), 14), YMD);
  const checkOut = pickedOut ?? prefillStay?.checkOut ?? format(addDays(new Date(), 16), YMD);
  const nights = nightsBetween(checkIn, checkOut);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const cityId = dest ? TRIP_HOTEL_CITY_IDS[dest.slug] : undefined;
    if (!dest || cityId === undefined) {
      setNeedCity(true);
      flagInvalid(destInputRef.current);
      destInputRef.current?.focus();
      return;
    }
    if (checkIn < today || nights < 1) {
      flagInvalid(dateButtonRef.current);
      setShowCalendar(true);
      return;
    }
    // 눌린 그 자리에서 바로 연다 — 주소를 미리 다 알아서 받아올 게 없고, 팝업 차단에도 안 걸린다
    openExternal(tripHotelSearchUrl({ cityId, cityName: dest.name, checkIn, checkOut, adults, rooms }, i18n.language));
  }

  return (
    <form className={styles.card} onSubmit={handleSubmit}>
      <div className={styles.grid}>
        <div className={styles.destination}>
          <DestinationField
            label={t('hotels.form.destination')}
            placeholder={t('hotels.form.destinationPlaceholder')}
            noMatch={t('hotels.form.noMatch')}
            value={dest}
            onChange={(d) => {
              clearInvalid(destInputRef.current);
              setNeedCity(false);
              setPickedDest(d);
            }}
            options={options}
            locale={i18n.language}
            inputRef={destInputRef}
          />
        </div>

        <div className={styles.dates}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>{t('hotels.form.dates')}</span>
            <button ref={dateButtonRef} type="button" className={`${styles.input} ${styles.dateButton}`} onClick={() => setShowCalendar(true)}>
              <CalendarDays size={16} aria-hidden="true" className={styles.dateIcon} />
              <span className={styles.dateText}>
                {formatDay(checkIn, i18n.language)}
                {' – '}
                {checkOut ? formatDay(checkOut, i18n.language) : t('hotels.form.pickCheckOut')}
              </span>
              {nights > 0 ? <span className={styles.nights}>{t('hotels.form.nights', { count: nights })}</span> : null}
            </button>
          </div>
        </div>

        <Stepper
          label={t('flights.form.adult')}
          value={adults}
          min={1}
          max={MAX_ADULTS}
          onChange={(n) => {
            setAdults(n);
            if (rooms > n) setRooms(n);
          }}
        />
        <Stepper label={t('hotels.form.rooms')} value={rooms} min={1} max={Math.min(MAX_ROOMS, adults)} onChange={setRooms} />

        <button type="submit" className={styles.submit}>
          <Search size={18} aria-hidden="true" /> {t('hotels.form.search')}
        </button>
      </div>

      {needCity ? (
        <p className={styles.error} role="alert">
          {t('hotels.form.pickCity')}{' '}
          <a href={tripHotelsHomeUrl(i18n.language)} target="_blank" rel="sponsored noopener" className={styles.errorLink}>
            {t('hotels.form.searchOnTrip')} <ExternalLink size={12} aria-hidden="true" />
          </a>
        </p>
      ) : null}

      {showCalendar ? (
        <div className={styles.calendarOverlay}>
          <div
            className={styles.calendarSheet}
            role="dialog"
            aria-modal="true"
            aria-label={t('hotels.form.dates')}
            onClick={(e) => e.stopPropagation()}
          >
            <CalendarRangePicker
              startDate={parseISO(checkIn)}
              endDate={checkOut ? parseISO(checkOut) : null}
              onChange={(start, end) => {
                if (!start) return;
                clearInvalid(dateButtonRef.current);
                setPickedIn(format(start, YMD));
                // 같은 날 체크인·체크아웃(0박)은 안 된다 — 그날을 체크인으로 두고 체크아웃을 다시 고르게
                if (end && isSameDay(start, end)) {
                  setPickedOut('');
                  return;
                }
                setPickedOut(end ? format(end, YMD) : '');
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
        <ExternalLink size={12} aria-hidden="true" /> {t('hotels.form.opensOnTrip')}
      </p>
      <p className={styles.note}>{t('hotels.form.childrenHint')}</p>
    </form>
  );
}
