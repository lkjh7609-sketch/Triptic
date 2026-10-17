import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays } from 'lucide-react';
import { DatePickerSheet } from '@/shared/ui/DatePickerSheet';
import { TimeBox } from '@/shared/ui/TimeBox';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import { ConfidenceField } from './ConfidenceField';
import { commitFlightBooking } from './commitBooking';
import { isFlightOutsideTrip, proposeTripPeriod, type Period } from './tripPeriod';
import { getVoucherSignedUrlByDocumentId, type BookingRow } from './documentService';
import { useConfirmBooking, useRejectBooking } from './useDocuments';
import { captureError } from '@/shared/monitoring';
import { FeedbackModal } from '@/features/settings/FeedbackModal';
import { AirportPicker, selectedAirportOf, type SelectedAirport } from '../plan/airports/AirportPicker';
import { useAirports } from '../plan/airports/useAirports';
import { lookupFlightSchedule } from '../plan/flightLookup/flightLookupService';
import { lookupFill } from '../plan/flightLookup/applyLookup';
import { fillAirportsByName, fillFromLookup, hasDateTime, isIata, joinLocal, lookupQuery, splitLocal } from './reviewAutofill';
import type { Airport } from '../plan/airports/airportData';
import type { FlightsData } from '../plan/types';
import type { ParsedFlight } from './parseBooking/schema';
import modalStyles from '../plan/AddPlaceModal.module.css';
import styles from './ReviewSheet.module.css';
import fieldStyles from './ConfidenceField.module.css';

interface ReviewSheetProps {
  tripId: string;
  bookings: BookingRow[];
  /** 목록을 (다시) 불러오는 중 — 비어 있어도 "없음"이 아니라 불러오는 중으로 */
  loading?: boolean;
  tripStartDate: string;
  tripEndDate: string;
  flightsData: FlightsData;
  onClose: () => void;
  /** flight는 좌표까지 갖춰져 있어 바로 flightsData에 반영할 수 있다(commitBooking.ts 참고) */
  onCommitFlight: (next: FlightsData) => Promise<void>;
  /** 항공권 날짜가 여행 기간과 다를 때 "항공권 기간으로 변경" — 없으면 경고만 */
  onChangeTripDates?: (period: Period) => Promise<void>;
}

/** 10월 7일 – 10월 14일 */
function formatPeriod(period: Period, locale: string): string {
  const fmt = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const d = (ymd: string) => fmt.format(new Date(`${ymd}T00:00:00Z`));
  return period.start === period.end ? d(period.start) : `${d(period.start)} – ${d(period.end)}`;
}

/**
 * 검수 시트 (04-document-ai.md §2 클라이언트 단계 6~9, 01-design-system.md §6.6)
 * "조용한 자동 확정 금지"(§1) — 여기를 거치지 않으면 어떤 파싱 결과도 일정에
 * 반영되지 않는다.
 */
export function ReviewSheet({
  tripId,
  bookings,
  loading = false,
  tripStartDate,
  tripEndDate,
  flightsData,
  onClose,
  onCommitFlight,
  onChangeTripDates,
}: ReviewSheetProps) {
  const { t, i18n } = useTranslation(['documents', 'common']);
  const [keepTripDates, setKeepTripDates] = useState(false);
  const [changingDates, setChangingDates] = useState(false);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(onClose);
  // 연달아 반영할 때 화면의 flightsData가 아직 갱신 전이어도 방금 넣은 칸을 지우지 않게 최신값을 따로 든다
  const flightsRef = useRef(flightsData);
  useEffect(() => {
    flightsRef.current = flightsData;
  }, [flightsData]);
  // 이 창에서 방금 반영한 항공편(문서별) — 검수 목록에서 빠져도 왕복 순서 판단에 쓴다
  const committedRef = useRef<{ documentId: string | null; flight: ParsedFlight }[]>([]);

  async function commitFlight(booking: BookingRow, edited: ParsedFlight): Promise<boolean> {
    const siblings = [
      ...bookings.filter((b) => b.id !== booking.id && b.document_id === booking.document_id && b.parsed.kind === 'flight').map((b) => b.parsed as ParsedFlight),
      ...committedRef.current.filter((c) => c.documentId === booking.document_id).map((c) => c.flight),
    ];
    const result = commitFlightBooking(edited, tripStartDate, tripEndDate, { sameDocumentFlights: siblings, existing: flightsRef.current });
    if (!result) return false;
    const next = { ...flightsRef.current, [result.slot]: result.flight };
    await onCommitFlight(next);
    flightsRef.current = next;
    committedRef.current.push({ documentId: booking.document_id, flight: edited });
    return true;
  }

  // 다 처리해 비었으면 부모가 창을 닫는다 — 불러오는 중일 때만 안내를 보여준다
  if (bookings.length === 0 && !loading) return null;

  const trip: Period = { start: tripStartDate, end: tripEndDate };
  const pendingFlights = bookings.filter((b) => b.parsed.kind === 'flight').map((b) => b.parsed as ParsedFlight);
  const proposal = tripStartDate && tripEndDate ? proposeTripPeriod(pendingFlights, trip) : null;

  async function handleUseTicketDates() {
    if (!proposal || !onChangeTripDates) return;
    setChangingDates(true);
    try {
      await onChangeTripDates(proposal);
    } catch (err) {
      captureError(err, { context: 'changeTripDatesFromTicket' });
    } finally {
      setChangingDates(false);
    }
  }

  if (bookings.length === 0) {
    return (
      <div className={modalStyles.overlay}>
        <div
          ref={focusTrapRef}
          className={modalStyles.sheet}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={t('review.dialogLabel')}
        >
          <h2 className={modalStyles.title}>{t('review.loading')}</h2>
          <div className={modalStyles.actions}>
            <button type="button" className={modalStyles.primary} onClick={onClose}>
              {t('action.close', { ns: 'common' })}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={modalStyles.overlay}>
      <div
        ref={focusTrapRef}
        className={modalStyles.sheet}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('review.dialogLabel')}
      >
        <h2 className={modalStyles.title}>{t('review.title')}</h2>
        <p className={styles.desc}>{t('review.desc')}</p>
        {proposal && !keepTripDates ? (
          <div className={styles.mismatch} role="alert">
            <p className={styles.mismatchTitle}>{t('review.dateMismatchTitle')}</p>
            <p className={styles.mismatchDetail}>
              {t('review.dateMismatchDetail', { trip: formatPeriod(trip, i18n.language), ticket: formatPeriod(proposal, i18n.language) })}
            </p>
            <div className={styles.mismatchActions}>
              <button type="button" className={modalStyles.secondary} onClick={() => setKeepTripDates(true)} disabled={changingDates}>
                {t('review.keepTripDates')}
              </button>
              {onChangeTripDates ? (
                <button type="button" className={modalStyles.primary} onClick={handleUseTicketDates} disabled={changingDates}>
                  {changingDates ? t('review.changingDates') : t('review.useTicketDates')}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className={styles.list}>
          {bookings.map((booking) =>
            booking.parsed.kind === 'flight' ? (
              <FlightBookingCard key={booking.id} tripId={tripId} booking={booking} flight={booking.parsed} trip={trip} onCommit={commitFlight} />
            ) : (
              <GenericBookingCard key={booking.id} tripId={tripId} booking={booking} />
            ),
          )}
        </div>
        <div className={modalStyles.actions}>
          <button type="button" className={modalStyles.secondary} onClick={onClose}>
            {t('action.close', { ns: 'common' })}
          </button>
        </div>
      </div>
    </div>
  );
}

async function openVoucher(documentId: string | null) {
  if (!documentId) return;
  const url = await getVoucherSignedUrlByDocumentId(documentId);
  if (url) window.open(url, '_blank', 'noopener');
}

interface FlightBookingCardProps {
  tripId: string;
  booking: BookingRow;
  flight: ParsedFlight;
  /** 여행 기간 — 출발일이 이 밖이면 일정에 넣을 수 없다(저장 시 일차에 배정되지 않아 사라진다) */
  trip: Period;
  /** 출국/귀국 칸을 정해 일정에 넣는다(ReviewSheet.commitFlight) — 못 넣으면 false */
  onCommit: (booking: BookingRow, edited: ParsedFlight) => Promise<boolean>;
}

/** "7월 20일 (월)" — 올해가 아니면 연도를 붙인다(항공편 추가 화면과 같은 모양) */
function formatDay(ymd: string, language: string): string {
  const d = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  const withYear = d.getFullYear() !== new Date().getFullYear();
  const day = new Intl.DateTimeFormat(language, { ...(withYear ? { year: 'numeric' } : {}), month: 'long', day: 'numeric' }).format(d);
  const weekday = new Intl.DateTimeFormat(language, { weekday: 'short' }).format(d);
  return `${day} (${weekday})`;
}

/** 출발·도착 시각 — 날짜(달력 시트) + 시각(시간 입력). 값은 서류에서 읽은 모양 그대로 'YYYY-MM-DDTHH:mm'로 둔다 */
function DateTimeField({
  label,
  value,
  trip,
  onChange,
}: {
  label: string;
  value: string | null;
  trip: Period;
  onChange: (part: 'date' | 'time', v: string) => void;
}) {
  const { t, i18n } = useTranslation('documents');
  const [sheetOpen, setSheetOpen] = useState(false);
  const { date, time } = splitLocal(value);
  const dateLabel = date ? formatDay(date, i18n.language) : t('review.pickDate');
  return (
    <div className={fieldStyles.field}>
      <span className={fieldStyles.label}>{label}</span>
      <button
        type="button"
        className={`${fieldStyles.input} ${styles.dateBtn}`}
        aria-label={`${label}: ${dateLabel}`}
        aria-haspopup="dialog"
        onClick={() => setSheetOpen(true)}
      >
        <CalendarDays size={16} aria-hidden="true" />
        <span className={date ? styles.dateText : styles.datePlaceholder}>{dateLabel}</span>
      </button>
      <TimeBox value={time} ariaLabel={`${label} ${t('review.timeAria')}`} onChange={(v) => onChange('time', v)} />
      {sheetOpen ? (
        <DatePickerSheet
          title={label}
          value={date}
          markStart={trip.start || null}
          markEnd={trip.end || null}
          onPick={(ymd) => onChange('date', ymd)}
          onClose={() => setSheetOpen(false)}
        />
      ) : null}
    </div>
  );
}

/** 읽은 공항 → 선택 창 값. 우리 공항 목록에 있으면 "도시(나라) 코드" 모양, 없으면 읽은 그대로(사용자가 목록에서 다시 고른다) */
function airportValue(side: ParsedFlight['departure'], list: readonly Airport[] | undefined, language: string): SelectedAirport | null {
  const iata = side.airportIata.value;
  if (!iata) return null;
  const known = list?.find((a) => a.iata === iata.toUpperCase());
  if (known) return selectedAirportOf(known, language);
  return { iata, name: side.airportName.value ?? iata, lat: side.airportLat ?? null, lng: side.airportLng ?? null };
}

function FlightBookingCard({ tripId, booking, flight, trip, onCommit }: FlightBookingCardProps) {
  const { t, i18n } = useTranslation(['documents', 'common', 'plan']);
  // 공항은 항공편 추가 화면(FlightModal)처럼 우리 공항 목록에서 고른다. 목록을 못 받으면 예전처럼 코드 입력 칸
  const { data: airportList, isLoading: airportsLoading } = useAirports();
  const listMode = airportsLoading || !!airportList?.length;
  const [requestText, setRequestText] = useState<string | null>(null);
  const confirmMutation = useConfirmBooking(tripId);
  const rejectMutation = useRejectBooking(tripId);
  const [saving, setSaving] = useState(false);
  const [edited, setEdited] = useState<ParsedFlight>(flight);
  // 기간 밖 항공편은 반영해도 저장되지 않아 사라진다 — 막고 이유를 보여준다(날짜를 고치면 다시 풀림)
  const outsideTrip = !!trip.start && !!trip.end && isFlightOutsideTrip(edited, trip);
  const depAirport = useMemo(() => airportValue(edited.departure, airportList, i18n.language), [edited.departure, airportList, i18n.language]);
  const arrAirport = useMemo(() => airportValue(edited.arrival, airportList, i18n.language), [edited.arrival, airportList, i18n.language]);
  // 공항 코드(영문 3자)와 날짜·시각이 다 있어야 반영할 수 있다 — 비어 있으면 아래 자동 채우기 뒤에도 사용자가 고른다
  const incomplete =
    !isIata(edited.departure.airportIata.value) ||
    !isIata(edited.arrival.airportIata.value) ||
    !hasDateTime(edited.departure.scheduledLocal.value) ||
    !hasDateTime(edited.arrival.scheduledLocal.value);
  const [autoState, setAutoState] = useState<'looking' | 'filled' | null>(null);
  const autoRan = useRef(false);

  // 빈 칸 자동 채우기(reviewAutofill.ts): 공항 이름 → 우리 목록, 그래도 비면 편명+출발일로 항공편 조회. 카드마다 한 번만
  useEffect(() => {
    if (autoRan.current || airportsLoading) return;
    autoRan.current = true;
    const list = airportList ?? [];
    const named = fillAirportsByName(flight, list, i18n.language);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (named !== flight) setEdited((prev) => fillAirportsByName(prev, list, i18n.language));
    const query = lookupQuery(named);
    if (!query) return;
    let alive = true;
    setAutoState('looking');
    lookupFlightSchedule(query.flightNo, query.date)
      .then((res) => {
        if (!alive) return;
        if (!res.found) return setAutoState(null);
        const fill = lookupFill(res.flight, list, i18n.language);
        setEdited((prev) => fillFromLookup(prev, fill));
        setAutoState('filled');
      })
      .catch(() => alive && setAutoState(null));
    return () => {
      alive = false;
    };
  }, [airportsLoading, airportList, flight, i18n.language]);

  function updateField<K extends 'flightNumber'>(key: K, value: string) {
    setEdited((prev) => ({ ...prev, [key]: { value, confidence: 1 } }));
  }
  function updateNested(side: 'departure' | 'arrival', key: 'airportIata', value: string) {
    setEdited((prev) => ({
      ...prev,
      [side]: { ...prev[side], [key]: { value: value.toUpperCase(), confidence: 1 } },
    }));
  }

  function setDateTime(side: 'departure' | 'arrival', part: 'date' | 'time', v: string) {
    setEdited((prev) => {
      const cur = splitLocal(prev[side].scheduledLocal.value);
      const next = part === 'date' ? joinLocal(v, cur.time) : joinLocal(cur.date, v);
      return { ...prev, [side]: { ...prev[side], scheduledLocal: { value: next, confidence: 1 } } };
    });
  }

  function pickAirport(side: 'departure' | 'arrival', a: SelectedAirport | null) {
    setEdited((prev) => ({
      ...prev,
      [side]: {
        ...prev[side],
        airportIata: { value: a?.iata || null, confidence: 1 },
        airportName: { value: a?.name ?? null, confidence: 1 },
        airportLat: a?.lat ?? null,
        airportLng: a?.lng ?? null,
      },
    }));
  }

  function airportField(side: 'departure' | 'arrival', label: string, value: SelectedAirport | null) {
    if (!listMode) {
      return <ConfidenceField label={label} value={edited[side].airportIata.value} onChange={(v) => updateNested(side, 'airportIata', v)} />;
    }
    return (
      <label className={fieldStyles.field}>
        <span className={fieldStyles.label}>{label}</span>
        <AirportPicker
          airports={airportList ?? []}
          value={value}
          onSelect={(a) => pickAirport(side, a)}
          placeholder={t('flight.airportListPlaceholder', { ns: 'plan' })}
          onRequest={setRequestText}
        />
      </label>
    );
  }

  async function handleConfirm() {
    setSaving(true);
    try {
      if (!(await onCommit(booking, edited))) {
        captureError(new Error('commitFlightBooking returned null'), { context: 'confirmBooking' });
        return;
      }
      await confirmMutation.mutateAsync({ bookingId: booking.id, edited });
    } catch (err) {
      captureError(err, { context: 'confirmFlightBooking' });
    } finally {
      setSaving(false);
    }
  }

  async function handleReject() {
    try {
      await rejectMutation.mutateAsync(booking.id);
    } catch (err) {
      captureError(err, { context: 'rejectBooking' });
    }
  }

  return (
    <div className={styles.card}>
      <p className={styles.kindLabel}>{t('review.flightLabel')}</p>
      <ConfidenceField
        label={t('review.flightNumberField')}
        value={edited.flightNumber.value}
        onChange={(v) => updateField('flightNumber', v)}
      />
      <div className={styles.row}>
        {airportField('departure', t('review.departureAirportField'), depAirport)}
        {airportField('arrival', t('review.arrivalAirportField'), arrAirport)}
      </div>
      <div className={styles.row}>
        <DateTimeField
          label={t('review.departureTimeField')}
          value={edited.departure.scheduledLocal.value}
          trip={trip}
          onChange={(part, v) => setDateTime('departure', part, v)}
        />
        <DateTimeField
          label={t('review.arrivalTimeField')}
          value={edited.arrival.scheduledLocal.value}
          trip={trip}
          onChange={(part, v) => setDateTime('arrival', part, v)}
        />
      </div>
      {autoState ? (
        <p className={styles.autoNote} role="status">
          {autoState === 'looking' ? t('review.autoLooking') : t('review.autoFilled')}
        </p>
      ) : null}
      {outsideTrip ? <p className={styles.outsideHint}>{t('review.outsideTripHint')}</p> : null}
      <div className={styles.cardActions}>
        <button type="button" className={modalStyles.secondary} onClick={handleReject} disabled={saving}>
          {t('review.ignore')}
        </button>
        <button type="button" className={modalStyles.primary} onClick={handleConfirm} disabled={saving || outsideTrip || incomplete}>
          {saving ? t('review.applying') : t('review.applyToItinerary')}
        </button>
      </div>
      {requestText !== null ? (
        <FeedbackModal initialBody={t('flight.airportRequestPrefill', { ns: 'plan', query: requestText })} onClose={() => setRequestText(null)} />
      ) : null}
    </div>
  );
}

interface GenericBookingCardProps {
  tripId: string;
  booking: BookingRow;
}

/**
 * 숙소/철도/렌터카/액티비티: 좌표 해석(§7 "호텔 좌표 → Google Places 해석")이
 * 아직 없어 자동 반영하지 못한다 — 추출된 내용을 보여주고 기존 검색 기반 입력
 * (🏨 숙소 / + 일정 추가)으로 직접 추가하도록 안내한다(다음 라운드에서 자동화).
 */
function GenericBookingCard({ tripId, booking }: GenericBookingCardProps) {
  const { t } = useTranslation(['documents', 'common']);
  const rejectMutation = useRejectBooking(tripId);

  async function handleReject() {
    try {
      await rejectMutation.mutateAsync(booking.id);
    } catch (err) {
      captureError(err, { context: 'rejectBooking' });
    }
  }

  const parsed = booking.parsed;
  const name =
    'propertyName' in parsed ? parsed.propertyName.value : 'name' in parsed ? parsed.name.value : null;

  return (
    <div className={styles.card}>
      <p className={styles.kindLabel}>
        {booking.type === 'lodging'
          ? t('review.lodgingLabel')
          : booking.type === 'rail'
            ? t('review.railLabel')
            : t('review.bookingLabel')}
      </p>
      <p className={styles.name}>{name ?? t('review.nameUnrecognized')}</p>
      <p className={styles.manualHint}>{t('review.manualHint')}</p>
      <div className={styles.cardActions}>
        <button type="button" className={modalStyles.secondary} onClick={() => openVoucher(booking.document_id)}>
          {t('confidenceField.viewOriginal')}
        </button>
        <button type="button" className={modalStyles.primary} onClick={handleReject}>
          {t('action.close', { ns: 'common' })}
        </button>
      </div>
    </div>
  );
}
