import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { usePlaceAutocomplete, type SelectedPlace } from './map/usePlaceAutocomplete';
import { AirportPicker, type SelectedAirport } from './airports/AirportPicker';
import { requireLogin } from '@/features/auth/loginPrompt';
import { FlightLookupError, lookupFlightSchedule } from './flightLookup/flightLookupService';
import { lookupFill } from './flightLookup/applyLookup';
import type { TerminalKey } from './flightLookup/schedule';
import { useAirports } from './airports/useAirports';
import { FeedbackModal } from '@/features/settings/FeedbackModal';
import { flightPreviewText } from './flights';
import { captureError } from '@/shared/monitoring';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import { flagInvalid } from '@/shared/ui/invalidField';
import type { FlightInfo, FlightsData } from './types';
import styles from './FlightModal.module.css';
import modalStyles from './AddPlaceModal.module.css';
import { Plane, Pencil, Trash2, CheckCircle, Search, CalendarDays } from 'lucide-react';
import { DatePickerSheet } from '@/shared/ui/DatePickerSheet';

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
            tripStart={startDate}
            tripEnd={endDate}
            value={outbound}
            onChange={setOutbound}
            onRequestAirport={setRequestText}
          />
          <FlightSlotEditor
            label={t('flight.returnLabel')}
            date={endDate ?? ''}
            tripStart={startDate}
            tripEnd={endDate}
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
  /** 날짜 달력에 은은하게 표시할 이 여행의 기간 */
  tripStart?: string | null;
  tripEnd?: string | null;
  value: FlightInfo | null;
  onChange: (flight: FlightInfo | null) => void;
  onRequestAirport: (query: string) => void;
}

function FlightSlotEditor({
  label,
  date,
  tripStart,
  tripEnd,
  value,
  onChange,
  onRequestAirport,
}: FlightSlotEditorProps) {
  const { t, i18n } = useTranslation(['plan', 'common']);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(!value);
  const [flightNo, setFlightNo] = useState(value?.flightNo ?? '');
  const [airline, setAirline] = useState(value?.airline ?? '');
  // 편명으로 불러오기 — 조회할 날짜(기본은 여행 첫날·마지막 날, 고칠 수 있다)와 자동으로 채운 값들
  const [flightDate, setFlightDate] = useState(value?.date || date);
  const [airlineCode, setAirlineCode] = useState(value?.airlineCode ?? '');
  const [depTerminal, setDepTerminal] = useState<TerminalKey | undefined>(value?.dep.terminal);
  const [arrTerminal, setArrTerminal] = useState<TerminalKey | undefined>(value?.arr.terminal);
  const [autoFilled, setAutoFilled] = useState(!!value && value.manual === false);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupNote, setLookupNote] = useState<string | null>(null);
  // 첫 화면은 편명·날짜·불러오기만 — 직접 입력 칸은 [직접 입력하기]를 누르거나, 못 찾았을 때, 이미 저장된 항공편을 고칠 때 펼쳐진다
  const [showManual, setShowManual] = useState(!!value);
  const [lookedUp, setLookedUp] = useState(false);
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
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

  /** 목록에서 직접 공항을 바꾸면 그쪽 터미널은 더 이상 맞지 않으므로 지운다 */
  function changeAirport(side: 'dep' | 'arr', a: SelectedAirport | null) {
    if (side === 'dep') setDepTerminal(undefined);
    else setArrTerminal(undefined);
    setAutoFilled(false);
    pickAirport(side, a);
  }

  async function handleLookup() {
    setError(null);
    setLookupNote(null);
    if (!flightNo.trim()) {
      setError(t('flight.flightNoRequired'));
      flagInvalid(flightNoRef.current);
      return;
    }
    if (!flightDate) {
      setError(t('flight.dateRequired'));
      return;
    }
    // 비로그인은 로그인 창을 먼저 — 외부 API 호출 한도를 지키려고 로그인한 사용자만 쓴다
    if (!requireLogin()) return;
    setLookupBusy(true);
    try {
      const res = await lookupFlightSchedule(flightNo, flightDate);
      if (!res.found) {
        setLookupNote(t(`flight.lookupMiss.${res.reason}`));
        setLookedUp(false);
        setShowManual(true);
        return;
      }
      const fill = lookupFill(res.flight, airportList, i18n.language);
      setFlightNo(fill.flightNo);
      setAirline(fill.airline);
      setAirlineCode(fill.airlineCode);
      pickAirport('dep', fill.dep.airport);
      pickAirport('arr', fill.arr.airport);
      if (!listMode) {
        if (depInputRef.current) depInputRef.current.value = fill.dep.airport.name;
        if (arrInputRef.current) arrInputRef.current.value = fill.arr.airport.name;
      }
      setDepTime(fill.dep.time);
      setArrTime(fill.arr.time);
      setDepTerminal(fill.dep.terminal ?? undefined);
      setArrTerminal(fill.arr.terminal ?? undefined);
      setAutoFilled(true);
      setLookedUp(true);
      setShowManual(false);
      // 밤새 인천에 도착하는 귀국편은 스케줄이 인천 도착일 기준이라 날짜를 그날로 맞춘다
      const shifted = fill.date !== flightDate;
      if (shifted) setFlightDate(fill.date);
      setLookupNote(
        shifted
          ? t('flight.lookupDateShifted', { date: fill.date })
          : fill.dep.time && fill.arr.time
            ? t('flight.lookupDone')
            : t('flight.lookupDonePartial'),
      );
    } catch (err) {
      if (err instanceof FlightLookupError && err.code === 'unauthorized') {
        requireLogin();
        return;
      }
      if (!(err instanceof FlightLookupError)) captureError(err, { context: 'flightLookup' });
      setLookupNote(t('flight.lookupFailed'));
      setLookedUp(false);
      setShowManual(true);
    } finally {
      setLookupBusy(false);
    }
  }

  useEffect(() => {
    if (!isEditing && value) {
      // eslint-disable-next-line
      setFlightNo(value.flightNo);
      setFlightDate(value.date || date);
      setAirlineCode(value.airlineCode ?? '');
      setDepTerminal(value.dep.terminal);
      setArrTerminal(value.arr.terminal);
      setAutoFilled(value.manual === false);
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
      // 요약만 보이는 상태에서 공항이 빠졌으면 입력 칸을 펼쳐 채울 수 있게 한다
      if (depMissing || arrMissing) setShowManual(true);
      setError(noMissing ? t('flight.flightNoRequired') : t('flight.airportRequired'));
      flagInvalid(noMissing ? flightNoRef.current : null, depMissing ? depInputRef.current : null, arrMissing ? arrInputRef.current : null);
      return;
    }
    setError(null);
    onChange({
      flightNo: flightNo.trim().toUpperCase(),
      date: flightDate || value?.date || date,
      airline: airline.trim(),
      ...(airlineCode ? { airlineCode } : {}),
      // 불러오기로 채운 값이면 '직접 입력' 표시를 달지 않는다
      manual: !autoFilled,
      dep: {
        iata: depIata,
        name: depPlace.name,
        lat: depPlace.lat,
        lng: depPlace.lng,
        time: depTime,
        ...(depTerminal ? { terminal: depTerminal } : {}),
      },
      arr: {
        iata: arrIata,
        name: arrPlace.name,
        lat: arrPlace.lat,
        lng: arrPlace.lng,
        time: arrTime,
        ...(arrTerminal ? { terminal: arrTerminal } : {}),
      },
    });
    setIsEditing(false);
  }

  /** 불러온(또는 입력 중인) 값의 한 줄 요약 */
  const draftSummary = useMemo(() => {
    const draft: FlightInfo = {
      flightNo,
      date: flightDate,
      airline,
      airlineCode: airlineCode || undefined,
      dep: { iata: depIata, name: depPlace?.name ?? '', lat: null, lng: null, time: depTime, terminal: depTerminal },
      arr: { iata: arrIata, name: arrPlace?.name ?? '', lat: null, lng: null, time: arrTime, terminal: arrTerminal },
    };
    return flightPreviewText(draft, t, i18n.language);
  }, [flightNo, flightDate, airline, airlineCode, depIata, depPlace, depTime, depTerminal, arrIata, arrPlace, arrTime, arrTerminal, t, i18n.language]);

  const dateLabel = useMemo(() => {
    if (!flightDate) return t('flight.pickDate');
    const d = new Date(`${flightDate}T00:00:00`);
    if (Number.isNaN(d.getTime())) return flightDate;
    // "11월 1일 (일)" — 올해가 아니면 연도를 붙인다
    const withYear = d.getFullYear() !== new Date().getFullYear();
    const day = new Intl.DateTimeFormat(i18n.language, { ...(withYear ? { year: 'numeric' } : {}), month: 'long', day: 'numeric' }).format(d);
    const weekday = new Intl.DateTimeFormat(i18n.language, { weekday: 'short' }).format(d);
    return `${day} (${weekday})`;
  }, [flightDate, i18n.language, t]);

  function handleRemove() {
    onChange(null);
    setIsEditing(true);
    setFlightNo('');
    setFlightDate(date);
    setAirlineCode('');
    setDepTerminal(undefined);
    setArrTerminal(undefined);
    setAutoFilled(false);
    setLookupNote(null);
    setLookedUp(false);
    setShowManual(false);
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
            <CheckCircle size={14} aria-hidden="true" /> {flightPreviewText(value, t, i18n.language)}
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
          <div className={styles.topGrid}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t('flight.flightNoLabel')}</span>
              <input
                ref={flightNoRef}
                className={styles.fieldInput}
                placeholder={t('flight.flightNoPlaceholder')}
                value={flightNo}
                onChange={(e) => {
                  setFlightNo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                  // 편명을 고치면 앞서 불러온 값은 더 이상 이 편의 것이 아니다
                  setAutoFilled(false);
                  setLookedUp(false);
                  setAirlineCode('');
                  setDepTerminal(undefined);
                  setArrTerminal(undefined);
                }}
              />
            </label>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>{t('flight.dateLabel')}</span>
              <button
                type="button"
                className={`${styles.fieldInput} ${styles.dateBtn}`}
                aria-label={`${t('flight.dateAria')}: ${dateLabel}`}
                aria-haspopup="dialog"
                onClick={() => setDateSheetOpen(true)}
              >
                <CalendarDays size={16} aria-hidden="true" />
                <span className={styles.dateText}>{dateLabel}</span>
              </button>
            </div>
            <button type="button" className={styles.lookupBtn} onClick={handleLookup} disabled={lookupBusy}>
              <Search size={16} aria-hidden="true" />
              {lookupBusy ? t('flight.lookingUp') : t('flight.lookupFromNo')}
            </button>
          </div>

          {lookupNote ? (
            <p className={styles.lookupNote} role="status">
              {lookupNote}
            </p>
          ) : null}

          {lookedUp && !showManual ? (
            <div className={styles.found}>
              <p className={styles.foundText}>
                <CheckCircle size={14} aria-hidden="true" /> {draftSummary}
              </p>
              {error ? (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              ) : null}
              <div className={styles.formActions}>
                <button type="button" className={styles.cancelManualBtn} onClick={() => setShowManual(true)}>
                  {t('flight.editManual')}
                </button>
                <button type="button" className={styles.applyManualBtn} onClick={handleApply}>
                  {t('flight.applyManual')}
                </button>
              </div>
            </div>
          ) : null}

          {!showManual && !lookedUp ? (
            <button type="button" className={styles.manualOpen} onClick={() => setShowManual(true)}>
              {t('flight.manualOpen')}
            </button>
          ) : null}

          {showManual ? (
            <>
              <div className={styles.fieldGrid}>
                <label className={`${styles.field} ${styles.fullRow}`}>
                  <span className={styles.fieldLabel}>{t('flight.airlineLabel')}</span>
                  <input
                    className={styles.fieldInput}
                    placeholder={t('flight.airlinePlaceholder')}
                    value={airline}
                    onChange={(e) => {
                      setAirline(e.target.value.toUpperCase());
                      setAirlineCode('');
                      setAutoFilled(false);
                    }}
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>{t('flight.depLabel')}</span>
                  {listMode ? (
                    <AirportPicker
                      airports={airportList ?? []}
                      value={depSelected}
                      onSelect={(a) => changeAirport('dep', a)}
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
                    className={`${styles.fieldInput} ${styles.timeInput}`}
                    value={depTime}
                    onChange={(e) => {
                      setDepTime(e.target.value);
                      setAutoFilled(false);
                    }}
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>{t('flight.arrLabel')}</span>
                  {listMode ? (
                    <AirportPicker
                      airports={airportList ?? []}
                      value={arrSelected}
                      onSelect={(a) => changeAirport('arr', a)}
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
                    className={`${styles.fieldInput} ${styles.timeInput}`}
                    value={arrTime}
                    onChange={(e) => {
                      setArrTime(e.target.value);
                      setAutoFilled(false);
                    }}
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
          ) : null}

          {!showManual && !lookedUp && error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}

          {dateSheetOpen ? (
            <DatePickerSheet
              title={t('flight.pickDate')}
              value={flightDate}
              markStart={tripStart}
              markEnd={tripEnd}
              onPick={(ymd) => {
                setFlightDate(ymd);
                setAutoFilled(false);
                setLookedUp(false);
              }}
              onClose={() => setDateSheetOpen(false)}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
