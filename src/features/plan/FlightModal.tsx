import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePlaceAutocomplete, type SelectedPlace } from './map/usePlaceAutocomplete';
import { flightPreviewText } from './flights';
import { captureError } from '@/shared/monitoring';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import type { FlightInfo, FlightsData } from './types';
import styles from './FlightModal.module.css';
import modalStyles from './AddPlaceModal.module.css';
import { Plane, Pencil, Trash2, CheckCircle } from 'lucide-react';

interface FlightModalProps {
  flightsData: FlightsData;
  /** 출국편 날짜로 쓴다(여행 첫날) */
  startDate?: string | null;
  /** 귀국편 날짜로 쓴다(여행 마지막 날) */
  endDate?: string | null;
  onClose: () => void;
  onSave: (flightsData: FlightsData) => Promise<void>;
}

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
        <h2 className={modalStyles.title}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><Plane size={18} /> {t('flight.title')}</span></h2>

        <FlightSlotEditor
          label={t('flight.outboundLabel')}
          date={startDate ?? ''}
          value={outbound}
          onChange={setOutbound}
        />
        <FlightSlotEditor
          label={t('flight.returnLabel')}
          date={endDate ?? ''}
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
  const { t } = useTranslation(['plan', 'common']);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(!value);
  const [flightNo, setFlightNo] = useState(value?.flightNo ?? '');
  const [airline, setAirline] = useState(value?.airline ?? '');
  const [depTime, setDepTime] = useState(value?.dep.time ?? '');
  const [arrTime, setArrTime] = useState(value?.arr.time ?? '');
  
  const [depPlace, setDepPlace] = useState<SelectedPlace | null>(
    value?.dep.name ? { name: value.dep.name, address: '', lat: value.dep.lat ?? 0, lng: value.dep.lng ?? 0, placeId: null, types: [] } : null,
  );
  const [arrPlace, setArrPlace] = useState<SelectedPlace | null>(
    value?.arr.name ? { name: value.arr.name, address: '', lat: value.arr.lat ?? 0, lng: value.arr.lng ?? 0, placeId: null, types: [] } : null,
  );
  
  const { inputRef: depInputRef } = usePlaceAutocomplete(setDepPlace, { types: ['airport'] });
  const { inputRef: arrInputRef } = usePlaceAutocomplete(setArrPlace, { types: ['airport'] });

  useEffect(() => {
    if (!isEditing && value) {
      // eslint-disable-next-line
      setFlightNo(value.flightNo);
      setAirline(value.airline || '');
      setDepTime(value.dep.time || '');
      setArrTime(value.arr.time || '');
      setDepPlace(value.dep.name ? { name: value.dep.name, address: '', lat: value.dep.lat ?? 0, lng: value.dep.lng ?? 0, placeId: null, types: [] } : null);
      setArrPlace(value.arr.name ? { name: value.arr.name, address: '', lat: value.arr.lat ?? 0, lng: value.arr.lng ?? 0, placeId: null, types: [] } : null);
    }
  }, [isEditing, value]);

  function handleApply() {
    if (!flightNo.trim()) {
      setError(t('flight.flightNoRequired'));
      return;
    }
    if (!depPlace?.name || !arrPlace?.name) {
      setError(t('flight.airportRequired'));
      return;
    }
    setError(null);
    onChange({
      flightNo: flightNo.trim().toUpperCase(),
      date: value?.date || date,
      airline: airline.trim(),
      manual: true,
      dep: { iata: '', name: depPlace.name, lat: depPlace.lat, lng: depPlace.lng, time: depTime },
      arr: { iata: '', name: arrPlace.name, lat: arrPlace.lat, lng: arrPlace.lng, time: arrTime },
    });
    setIsEditing(false);
  }

  function handleRemove() {
    onChange(null);
    setIsEditing(true);
    setFlightNo('');
    setAirline('');
    setDepTime('');
    setArrTime('');
    setDepPlace(null);
    setArrPlace(null);
    if (depInputRef.current) depInputRef.current.value = '';
    if (arrInputRef.current) arrInputRef.current.value = '';
  }

  return (
    <div className={styles.slot}>
      <div className={styles.slotLabel}>{label}</div>

      {!isEditing && value ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p className={styles.preview}>
            <CheckCircle size={14} aria-hidden="true" /> {flightPreviewText(value, t)}
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className={styles.manualToggle} onClick={() => setIsEditing(true)}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Pencil size={16} aria-hidden="true" /> {t('common:action.edit')}</span>
            </button>
            <button type="button" className={styles.manualToggle} style={{ color: 'var(--danger)' }} onClick={handleRemove}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Trash2 size={16} aria-hidden="true" /> {t('common:action.delete')}</span>
            </button>
          </div>
        </div>
      ) : null}

      <div className={styles.manualFields} style={{ display: isEditing ? 'flex' : 'none', marginTop: value ? '12px' : '0' }}>
        <input
          className={modalStyles.input}
          placeholder={t('flight.flightNoPlaceholder')}
          aria-label={t('flight.flightNoPlaceholder')}
          value={flightNo}
          onChange={(e) => setFlightNo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
        />
        <input
          className={modalStyles.input}
          placeholder={t('flight.airlinePlaceholder')}
          aria-label={t('flight.airlinePlaceholder')}
          value={airline}
          onChange={(e) => setAirline(e.target.value.toUpperCase())}
        />
        <input
          ref={depInputRef}
          className={modalStyles.input}
          placeholder={t('flight.depPlaceholder')}
          aria-label={t('flight.depPlaceholder')}
          defaultValue={depPlace?.name}
        />
        <input
          type="time"
          className={modalStyles.input}
          aria-label={t('flight.depTimeAria')}
          value={depTime}
          onChange={(e) => setDepTime(e.target.value)}
        />
        <input
          ref={arrInputRef}
          className={modalStyles.input}
          placeholder={t('flight.arrPlaceholder')}
          aria-label={t('flight.arrPlaceholder')}
          defaultValue={arrPlace?.name}
        />
        <input
          type="time"
          className={modalStyles.input}
          aria-label={t('flight.arrTimeAria')}
          value={arrTime}
          onChange={(e) => setArrTime(e.target.value)}
        />
        {error ? (
          <p className={modalStyles.error} role="alert">
            {error}
          </p>
        ) : null}
        <div style={{ display: 'flex', gap: '8px' }}>
          {value && (
            <button type="button" className={modalStyles.secondary} style={{ flex: 1 }} onClick={() => setIsEditing(false)}>
              {t('common:action.cancel')}
            </button>
          )}
          <button type="button" className={styles.applyManualBtn} style={{ flex: value ? 2 : 1 }} onClick={handleApply}>
            {value ? t('flight.applyEdit') : t('flight.applyManual')}
          </button>
        </div>
      </div>
    </div>
  );
}
