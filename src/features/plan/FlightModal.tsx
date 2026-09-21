import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePlaceAutocomplete, type SelectedPlace } from './map/usePlaceAutocomplete';
import { lookupFlight } from './flightApi';
import { flightPreviewText } from './flights';
import { captureError } from '@/shared/monitoring';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import type { FlightInfo, FlightsData } from './types';
import styles from './FlightModal.module.css';
import modalStyles from './AddPlaceModal.module.css';

interface FlightModalProps {
  flightsData: FlightsData;
  startDate: string;
  endDate: string;
  onClose: () => void;
  onSave: (flightsData: FlightsData) => Promise<void>;
}

/**
 * 항공편 (index.html lookupFlightForModal/saveManualFlight 이식)
 * 편명으로 자동 조회하고, 실패하면 수동 입력 폼으로 폴백한다. 출국(outbound)은
 * 첫날 도착 지점으로, 귀국(return)은 마지막날 출발 지점으로 경로 계산에
 * 반영된다(TripDetailScreen → useTripRoutes).
 */
export function FlightModal({ flightsData, startDate, endDate, onClose, onSave }: FlightModalProps) {
  const { t } = useTranslation(['plan', 'common']);
  const [outbound, setOutbound] = useState<FlightInfo | null>(flightsData.outbound);
  const [returnFlight, setReturnFlight] = useState<FlightInfo | null>(flightsData.return);
  const [saving, setSaving] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({ outbound, return: returnFlight });
      onClose();
    } catch (err) {
      captureError(err, { context: 'saveFlights' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={modalStyles.overlay} onClick={onClose}>
      <div
        ref={trapRef}
        className={modalStyles.sheet}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('flight.title')}
      >
        <h2 className={modalStyles.title}>✈️ {t('flight.title')}</h2>

        <FlightSlotEditor
          label={t('flight.outboundLabel')}
          date={startDate}
          value={outbound}
          onChange={setOutbound}
        />
        <FlightSlotEditor
          label={t('flight.returnLabel')}
          date={endDate}
          value={returnFlight}
          onChange={setReturnFlight}
        />

        <div className={modalStyles.actions}>
          <button type="button" className={modalStyles.secondary} onClick={onClose}>
            {t('action.cancel', { ns: 'common' })}
          </button>
          <button type="button" className={modalStyles.primary} disabled={saving} onClick={handleSave}>
            {saving ? t('flight.saving') : t('action.save', { ns: 'common' })}
          </button>
        </div>
      </div>
    </div>
  );
}

interface FlightSlotEditorProps {
  label: string;
  date: string;
  value: FlightInfo | null;
  onChange: (flight: FlightInfo | null) => void;
}

function FlightSlotEditor({ label, date, value, onChange }: FlightSlotEditorProps) {
  const { t } = useTranslation('plan');
  const [flightNo, setFlightNo] = useState(value?.flightNo ?? '');
  const [loading, setLoading] = useState(false);
  const [showManual, setShowManual] = useState(!!value?.manual);
  const [airline, setAirline] = useState(value?.airline ?? '');
  const [depTime, setDepTime] = useState(value?.dep.time ?? '');
  const [arrTime, setArrTime] = useState(value?.arr.time ?? '');
  const [depPlace, setDepPlace] = useState<SelectedPlace | null>(
    value?.dep.name ? { name: value.dep.name, address: '', lat: value.dep.lat ?? 0, lng: value.dep.lng ?? 0, placeId: null, types: [] } : null,
  );
  const [arrPlace, setArrPlace] = useState<SelectedPlace | null>(
    value?.arr.name ? { name: value.arr.name, address: '', lat: value.arr.lat ?? 0, lng: value.arr.lng ?? 0, placeId: null, types: [] } : null,
  );
  const { inputRef: depInputRef } = usePlaceAutocomplete(setDepPlace);
  const { inputRef: arrInputRef } = usePlaceAutocomplete(setArrPlace);

  async function handleLookup() {
    if (!flightNo.trim()) return;
    if (!date) return;
    setLoading(true);
    try {
      const result = await lookupFlight(flightNo, date);
      if (result) {
        onChange(result);
        setShowManual(false);
      } else {
        onChange(null);
        setShowManual(true);
      }
    } catch (err) {
      captureError(err, { context: 'lookupFlight' });
    } finally {
      setLoading(false);
    }
  }

  function handleApplyManual() {
    if (!flightNo.trim() || !depPlace?.name || !arrPlace?.name) return;
    onChange({
      flightNo: flightNo.trim().toUpperCase(),
      date: '',
      airline: airline.trim(),
      manual: true,
      dep: { iata: '', name: depPlace.name, lat: depPlace.lat, lng: depPlace.lng, time: depTime },
      arr: { iata: '', name: arrPlace.name, lat: arrPlace.lat, lng: arrPlace.lng, time: arrTime },
    });
    setShowManual(false);
  }

  return (
    <div className={styles.slot}>
      <div className={styles.slotLabel}>{label}</div>
      <div className={styles.lookupRow}>
        <input
          className={styles.flightNoInput}
          placeholder={t('flight.flightNoPlaceholder')}
          value={flightNo}
          onChange={(e) => setFlightNo(e.target.value)}
        />
        <button type="button" className={styles.lookupBtn} disabled={loading} onClick={handleLookup}>
          {loading ? t('flight.lookingUp') : t('flight.lookupBtn')}
        </button>
      </div>

      {value ? <p className={styles.preview}>{flightPreviewText(value)}</p> : null}
      {!value && !loading ? (
        <p className={styles.hint}>ℹ️ {t('flight.noResultHint')}</p>
      ) : null}

      <button type="button" className={styles.manualToggle} onClick={() => setShowManual((v) => !v)}>
        ✏️ {t('flight.manualToggle')}
      </button>

      {showManual ? (
        <div className={styles.manualFields}>
          <input
            className={modalStyles.input}
            placeholder={t('flight.airlinePlaceholder')}
            value={airline}
            onChange={(e) => setAirline(e.target.value)}
          />
          <input
            ref={depInputRef}
            className={modalStyles.input}
            placeholder={t('flight.depPlaceholder')}
            defaultValue={depPlace?.name}
          />
          <input
            type="time"
            className={modalStyles.input}
            value={depTime}
            onChange={(e) => setDepTime(e.target.value)}
          />
          <input
            ref={arrInputRef}
            className={modalStyles.input}
            placeholder={t('flight.arrPlaceholder')}
            defaultValue={arrPlace?.name}
          />
          <input
            type="time"
            className={modalStyles.input}
            value={arrTime}
            onChange={(e) => setArrTime(e.target.value)}
          />
          <button type="button" className={styles.applyManualBtn} onClick={handleApplyManual}>
            {t('flight.applyManual')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
