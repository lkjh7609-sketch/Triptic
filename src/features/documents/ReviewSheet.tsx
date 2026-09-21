import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import { ConfidenceField } from './ConfidenceField';
import { commitFlightBooking } from './commitBooking';
import { getVoucherSignedUrlByDocumentId, type BookingRow } from './documentService';
import { useConfirmBooking, useRejectBooking } from './useDocuments';
import { captureError } from '@/shared/monitoring';
import type { FlightsData } from '../plan/types';
import type { ParsedFlight } from './parseBooking/schema';
import modalStyles from '../plan/AddPlaceModal.module.css';
import styles from './ReviewSheet.module.css';

interface ReviewSheetProps {
  tripId: string;
  bookings: BookingRow[];
  tripStartDate: string;
  tripEndDate: string;
  flightsData: FlightsData;
  onClose: () => void;
  /** flight는 좌표까지 갖춰져 있어 바로 flightsData에 반영할 수 있다(commitBooking.ts 참고) */
  onCommitFlight: (next: FlightsData) => Promise<void>;
}

/**
 * 검수 시트 (04-document-ai.md §2 클라이언트 단계 6~9, 01-design-system.md §6.6)
 * "조용한 자동 확정 금지"(§1) — 여기를 거치지 않으면 어떤 파싱 결과도 일정에
 * 반영되지 않는다.
 */
export function ReviewSheet({
  tripId,
  bookings,
  tripStartDate,
  tripEndDate,
  flightsData,
  onClose,
  onCommitFlight,
}: ReviewSheetProps) {
  const { t } = useTranslation(['documents', 'common']);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(onClose);

  if (bookings.length === 0) {
    return (
      <div className={modalStyles.overlay} onClick={onClose}>
        <div
          ref={focusTrapRef}
          className={modalStyles.sheet}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={t('review.dialogLabel')}
        >
          <h2 className={modalStyles.title}>{t('review.emptyTitle')}</h2>
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
    <div className={modalStyles.overlay} onClick={onClose}>
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
        <div className={styles.list}>
          {bookings.map((booking) =>
            booking.parsed.kind === 'flight' ? (
              <FlightBookingCard
                key={booking.id}
                tripId={tripId}
                booking={booking}
                flight={booking.parsed}
                tripStartDate={tripStartDate}
                tripEndDate={tripEndDate}
                flightsData={flightsData}
                onCommitFlight={onCommitFlight}
              />
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
  tripStartDate: string;
  tripEndDate: string;
  flightsData: FlightsData;
  onCommitFlight: (next: FlightsData) => Promise<void>;
}

function FlightBookingCard({
  tripId,
  booking,
  flight,
  tripStartDate,
  tripEndDate,
  flightsData,
  onCommitFlight,
}: FlightBookingCardProps) {
  const { t } = useTranslation(['documents', 'common']);
  const confirmMutation = useConfirmBooking(tripId);
  const rejectMutation = useRejectBooking(tripId);
  const [saving, setSaving] = useState(false);
  const [edited, setEdited] = useState<ParsedFlight>(flight);

  function updateField<K extends 'flightNumber'>(key: K, value: string) {
    setEdited((prev) => ({ ...prev, [key]: { value, confidence: 1 } }));
  }
  function updateNested(side: 'departure' | 'arrival', key: 'airportIata' | 'scheduledLocal', value: string) {
    setEdited((prev) => ({
      ...prev,
      [side]: { ...prev[side], [key]: { value: key === 'airportIata' ? value.toUpperCase() : value, confidence: 1 } },
    }));
  }

  async function handleConfirm() {
    setSaving(true);
    try {
      const result = commitFlightBooking(edited, tripStartDate, tripEndDate);
      if (!result) {
        captureError(new Error('commitFlightBooking returned null'), { context: 'confirmBooking' });
        return;
      }
      await onCommitFlight({ ...flightsData, [result.slot]: result.flight });
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
        confidence={edited.flightNumber.confidence}
        onChange={(v) => updateField('flightNumber', v)}
        onViewOriginal={() => openVoucher(booking.document_id)}
      />
      <div className={styles.row}>
        <ConfidenceField
          label={t('review.departureAirportField')}
          value={edited.departure.airportIata.value}
          confidence={edited.departure.airportIata.confidence}
          onChange={(v) => updateNested('departure', 'airportIata', v)}
        />
        <ConfidenceField
          label={t('review.arrivalAirportField')}
          value={edited.arrival.airportIata.value}
          confidence={edited.arrival.airportIata.confidence}
          onChange={(v) => updateNested('arrival', 'airportIata', v)}
        />
      </div>
      <div className={styles.row}>
        <ConfidenceField
          label={t('review.departureTimeField')}
          value={edited.departure.scheduledLocal.value}
          confidence={edited.departure.scheduledLocal.confidence}
          onChange={(v) => updateNested('departure', 'scheduledLocal', v)}
        />
        <ConfidenceField
          label={t('review.arrivalTimeField')}
          value={edited.arrival.scheduledLocal.value}
          confidence={edited.arrival.scheduledLocal.confidence}
          onChange={(v) => updateNested('arrival', 'scheduledLocal', v)}
        />
      </div>
      <div className={styles.cardActions}>
        <button type="button" className={modalStyles.secondary} onClick={handleReject} disabled={saving}>
          {t('review.ignore')}
        </button>
        <button type="button" className={modalStyles.primary} onClick={handleConfirm} disabled={saving}>
          {saving ? t('review.applying') : t('review.applyToItinerary')}
        </button>
      </div>
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
