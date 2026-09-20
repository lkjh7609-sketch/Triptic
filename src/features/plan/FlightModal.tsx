import { useState } from 'react';
import { usePlaceAutocomplete, type SelectedPlace } from './map/usePlaceAutocomplete';
import { lookupFlight } from './flightApi';
import { flightPreviewText } from './flights';
import { captureError } from '@/shared/monitoring';
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
  const [outbound, setOutbound] = useState<FlightInfo | null>(flightsData.outbound);
  const [returnFlight, setReturnFlight] = useState<FlightInfo | null>(flightsData.return);
  const [saving, setSaving] = useState(false);

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
      <div className={modalStyles.sheet} onClick={(e) => e.stopPropagation()}>
        <h2 className={modalStyles.title}>✈️ 항공편</h2>

        <FlightSlotEditor
          label="출국"
          date={startDate}
          value={outbound}
          onChange={setOutbound}
        />
        <FlightSlotEditor
          label="귀국"
          date={endDate}
          value={returnFlight}
          onChange={setReturnFlight}
        />

        <div className={modalStyles.actions}>
          <button type="button" className={modalStyles.secondary} onClick={onClose}>
            취소
          </button>
          <button type="button" className={modalStyles.primary} disabled={saving} onClick={handleSave}>
            {saving ? '저장 중…' : '저장'}
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
          placeholder="편명 (예: OZ102)"
          value={flightNo}
          onChange={(e) => setFlightNo(e.target.value)}
        />
        <button type="button" className={styles.lookupBtn} disabled={loading} onClick={handleLookup}>
          {loading ? '조회 중…' : '조회'}
        </button>
      </div>

      {value ? <p className={styles.preview}>{flightPreviewText(value)}</p> : null}
      {!value && !loading ? (
        <p className={styles.hint}>ℹ️ 자동 조회 결과가 없으면 아래에서 직접 입력할 수 있어요.</p>
      ) : null}

      <button type="button" className={styles.manualToggle} onClick={() => setShowManual((v) => !v)}>
        ✏️ 항공편 직접 입력 (수동 지정)
      </button>

      {showManual ? (
        <div className={styles.manualFields}>
          <input
            className={modalStyles.input}
            placeholder="항공사 (예: 대한항공)"
            value={airline}
            onChange={(e) => setAirline(e.target.value)}
          />
          <input
            ref={depInputRef}
            className={modalStyles.input}
            placeholder="출발 공항 검색 (예: 인천국제공항)"
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
            placeholder="도착 공항 검색 (예: 간사이 국제공항)"
            defaultValue={arrPlace?.name}
          />
          <input
            type="time"
            className={modalStyles.input}
            value={arrTime}
            onChange={(e) => setArrTime(e.target.value)}
          />
          <button type="button" className={styles.applyManualBtn} onClick={handleApplyManual}>
            이 항공편 정보 적용
          </button>
        </div>
      ) : null}
    </div>
  );
}
