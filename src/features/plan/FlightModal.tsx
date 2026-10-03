import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { usePlaceAutocomplete, type SelectedPlace } from './map/usePlaceAutocomplete';
import { AirportPicker, type SelectedAirport } from './airports/AirportPicker';
import { useAirports } from './airports/useAirports';
import { FeedbackModal } from '@/features/settings/FeedbackModal';
import { flightPreviewText } from './flights';
import { captureError } from '@/shared/monitoring';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import { flagInvalid } from '@/shared/ui/invalidField';
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
  // 목록에 없는 공항 '추가 요청' — 문의하기 창을 머리말과 함께 연다
  const [requestText, setRequestText] = useState<string | null>(null);
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
    <>
      <div className={modalStyles.overlay}>
        <div
          ref={trapRef}
          className={modalStyles.sheet}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={t('flight.title')}
        >
          <h2 className={modalStyles.title}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <Plane size={18} /> {t('flight.title')}
            </span>
          </h2>

          <FlightSlotEditor
            label={t('flight.outboundLabel')}
            date={startDate ?? ''}
            value={outbound}
            onChange={setOutbound}
            onRequestAirport={setRequestText}
          />
          <FlightSlotEditor
            label={t('flight.returnLabel')}
            date={endDate ?? ''}
            value={returnFlight}
            onChange={setReturnFlight}
            onRequestAirport={setRequestText}
          />

          <div className={modalStyles.actions}>
            <button type="button" className={modalStyles.secondary} onClick={onClose}>
              {t('action.cancel', { ns: 'common' })}
            </button>
            <button
              type="button"
              className={modalStyles.primary}
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? t('flight.saving') : t('action.save', { ns: 'common' })}
            </button>
          </div>
        </div>
      </div>
      {requestText !== null ? (
        <FeedbackModal
          initialBody={t('flight.airportRequestPrefill', { query: requestText })}
          onClose={() => setRequestText(null)}
        />
      ) : null}
    </>
  );
}

interface FlightSlotEditorProps {
  label: string;
  date: string;
  value: FlightInfo | null;
  onChange: (flight: FlightInfo | null) => void;
  onRequestAirport: (query: string) => void;
}

function FlightSlotEditor({
  label,
  date,
  value,
  onChange,
  onRequestAirport,
}: FlightSlotEditorProps) {
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

  // 공항 코드 — 목록에서 고르면 채워지고, 예전에 Google로 입력한 항공편은 값 그대로(비어 있을 수 있음)
  const [depIata, setDepIata] = useState(value?.dep.iata ?? '');
  const [arrIata, setArrIata] = useState(value?.arr.iata ?? '');

  const flightNoRef = useRef<HTMLInputElement>(null);
  // 공항은 우리 공항 목록에서만 고른다. 목록을 받지 못하면(표가 아직 없거나 네트워크 오류) 예전처럼 Google 검색으로 돌아간다
  const { data: airportList, isLoading: airportsLoading } = useAirports();
  const listMode = airportsLoading || !!airportList?.length;
  const { inputRef: depInputRef } = usePlaceAutocomplete(setDepPlace, {
    types: ['airport'],
    enabled: !listMode,
  });
  const { inputRef: arrInputRef } = usePlaceAutocomplete(setArrPlace, {
    types: ['airport'],
    enabled: !listMode,
  });
  const depSelected = useMemo<SelectedAirport | null>(
    () =>
      depPlace
        ? { iata: depIata, name: depPlace.name, lat: depPlace.lat, lng: depPlace.lng }
        : null,
    [depPlace, depIata],
  );
  const arrSelected = useMemo<SelectedAirport | null>(
    () =>
      arrPlace
        ? { iata: arrIata, name: arrPlace.name, lat: arrPlace.lat, lng: arrPlace.lng }
        : null,
    [arrPlace, arrIata],
  );

  function pickAirport(side: 'dep' | 'arr', a: SelectedAirport | null) {
    const place: SelectedPlace | null = a
      ? {
          name: a.name,
          address: '',
          lat: a.lat ?? 0,
          lng: a.lng ?? 0,
          placeId: null,
          types: ['airport'],
        }
      : null;
    if (side === 'dep') {
      setDepPlace(place);
      setDepIata(a?.iata ?? '');
    } else {
      setArrPlace(place);
      setArrIata(a?.iata ?? '');
    }
  }

  useEffect(() => {
    if (!isEditing && value) {
      // eslint-disable-next-line
      setFlightNo(value.flightNo);
      setAirline(value.airline || '');
      setDepTime(value.dep.time || '');
      setArrTime(value.arr.time || '');
      setDepPlace(
        value.dep.name
          ? {
              name: value.dep.name,
              address: '',
              lat: value.dep.lat ?? 0,
              lng: value.dep.lng ?? 0,
              placeId: null,
              types: [],
            }
          : null,
      );
      setArrPlace(
        value.arr.name
          ? {
              name: value.arr.name,
              address: '',
              lat: value.arr.lat ?? 0,
              lng: value.arr.lng ?? 0,
              placeId: null,
              types: [],
            }
          : null,
      );
      setDepIata(value.dep.iata ?? '');
      setArrIata(value.arr.iata ?? '');
    }
  }, [isEditing, value]);

  function handleApply() {
    const noMissing = !flightNo.trim();
    const depMissing = !depPlace?.name;
    const arrMissing = !arrPlace?.name;
    if (noMissing || depMissing || arrMissing) {
      setError(noMissing ? t('flight.flightNoRequired') : t('flight.airportRequired'));
      flagInvalid(noMissing ? flightNoRef.current : null, depMissing ? depInputRef.current : null, arrMissing ? arrInputRef.current : null);
      return;
    }
    setError(null);
    onChange({
      flightNo: flightNo.trim().toUpperCase(),
      date: value?.date || date,
      airline: airline.trim(),
      manual: true,
      dep: {
        iata: depIata,
        name: depPlace.name,
        lat: depPlace.lat,
        lng: depPlace.lng,
        time: depTime,
      },
      arr: {
        iata: arrIata,
        name: arrPlace.name,
        lat: arrPlace.lat,
        lng: arrPlace.lng,
        time: arrTime,
      },
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
    setDepIata('');
    setArrIata('');
    if (!listMode) {
      if (depInputRef.current) depInputRef.current.value = '';
      if (arrInputRef.current) arrInputRef.current.value = '';
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.slotLabel}>{label}</div>

      {!isEditing && value ? (
        <>
          <p className={styles.preview}>
            <CheckCircle size={14} aria-hidden="true" /> {flightPreviewText(value, t)}
          </p>
          <div className={styles.previewActions}>
            <button type="button" className={styles.manualToggle} onClick={() => setIsEditing(true)}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Pencil size={14} aria-hidden="true" /> {t('common:action.edit')}</span>
            </button>
            <button type="button" className={styles.manualToggleDanger} onClick={handleRemove}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Trash2 size={14} aria-hidden="true" /> {t('common:action.delete')}</span>
            </button>
          </div>
        </>
      ) : (
        <>
          <div className={styles.fieldGrid}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t('flight.flightNoLabel')}</span>
              <input
                ref={flightNoRef}
                className={styles.fieldInput}
                placeholder={t('flight.flightNoPlaceholder')}
                value={flightNo}
                onChange={(e) => setFlightNo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t('flight.airlineLabel')}</span>
              <input
                className={styles.fieldInput}
                placeholder={t('flight.airlinePlaceholder')}
                value={airline}
                onChange={(e) => setAirline(e.target.value.toUpperCase())}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t('flight.depLabel')}</span>
              {listMode ? (
                <AirportPicker
                  airports={airportList ?? []}
                  value={depSelected}
                  onSelect={(a) => pickAirport('dep', a)}
                  placeholder={t('flight.airportListPlaceholder')}
                  inputRef={depInputRef}
                  onRequest={onRequestAirport}
                />
              ) : (
                <input
                  ref={depInputRef}
                  className={styles.fieldInput}
                  placeholder={t('flight.depPlaceholder')}
                  defaultValue={depPlace?.name}
                />
              )}
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t('flight.depTimeAria')}</span>
              <input
                type="time"
                className={styles.fieldInput}
                value={depTime}
                onChange={(e) => setDepTime(e.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t('flight.arrLabel')}</span>
              {listMode ? (
                <AirportPicker
                  airports={airportList ?? []}
                  value={arrSelected}
                  onSelect={(a) => pickAirport('arr', a)}
                  placeholder={t('flight.airportListPlaceholder')}
                  inputRef={arrInputRef}
                  onRequest={onRequestAirport}
                />
              ) : (
                <input
                  ref={arrInputRef}
                  className={styles.fieldInput}
                  placeholder={t('flight.arrPlaceholder')}
                  defaultValue={arrPlace?.name}
                />
              )}
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t('flight.arrTimeAria')}</span>
              <input
                type="time"
                className={styles.fieldInput}
                value={arrTime}
                onChange={(e) => setArrTime(e.target.value)}
              />
            </label>

            {error ? (
              <p className={styles.error} role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <div className={styles.formActions}>
            {value ? (
              <button type="button" className={styles.cancelManualBtn} onClick={() => setIsEditing(false)}>
                {t('common:action.cancel')}
              </button>
            ) : null}
            <button type="button" className={styles.applyManualBtn} onClick={handleApply}>
              {value ? t('flight.applyEdit') : t('flight.applyManual')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
