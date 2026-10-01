import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Ban, Check, Luggage, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import { useCityImage } from '@/shared/hooks/useCityImage';
import type { TripRow } from '@/shared/api/tripService';
import { formatTripPeriod } from './tripPeriodText';
import styles from './TripPickerSheet.module.css';

const CLOSE_MS = 200;

/** 일정의 도시 사진(동그란 썸네일), 도시가 없으면 가방 아이콘 */
export function TripThumb({ city, className }: { city: string | null; className?: string }) {
  const image = useCityImage(city);
  return city && image ? (
    <img src={image} alt="" className={`${styles.thumb} ${className ?? ''}`} loading="lazy" decoding="async" />
  ) : (
    <span className={`${styles.thumb} ${styles.thumbEmpty} ${className ?? ''}`} aria-hidden="true">
      <Luggage size={18} />
    </span>
  );
}

interface TripPickerSheetProps {
  trips: TripRow[];
  /** 지금 붙어 있는 일정 id('' = 없음) */
  selectedId: string;
  onSelect: (tripId: string) => void;
  onClose: () => void;
}

/** "내 일정 첨부" — 모바일은 하단 시트, PC는 가운데 창(CSS). 배경을 눌러도 닫히지 않고 닫기 버튼·Esc로만 닫힌다 */
export function TripPickerSheet({ trips, selectedId, onSelect, onClose }: TripPickerSheetProps) {
  const { t } = useTranslation('community');
  const [closing, setClosing] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  function requestClose(after?: () => void) {
    if (closing) return;
    setClosing(true);
    timer.current = window.setTimeout(() => {
      after?.();
      onClose();
    }, CLOSE_MS);
  }
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const trapRef = useFocusTrap<HTMLDivElement>(() => requestClose());

  return createPortal(
    <div className={`${styles.overlay} ${closing ? styles.overlayOut : ''}`}>
      <div
        ref={trapRef}
        className={`${styles.panel} ${closing ? styles.panelOut : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trip-picker-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.handle} aria-hidden="true" />
        <div className={styles.header}>
          <div className={styles.headerText}>
            <h2 id="trip-picker-title" className={styles.title}>
              {t('compose.trip.sheetTitle')}
            </h2>
            <p className={styles.sub}>{t('compose.trip.sheetSub')}</p>
          </div>
          <button type="button" className={styles.iconBtn} onClick={() => requestClose()} aria-label={t('picker.close')}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <ul className={styles.list}>
          <li>
            <button type="button" className={`${styles.row} ${selectedId === '' ? styles.rowOn : ''}`} onClick={() => requestClose(() => onSelect(''))}>
              <span className={`${styles.thumb} ${styles.thumbEmpty}`} aria-hidden="true">
                <Ban size={18} />
              </span>
              <span className={styles.rowText}>
                <span className={styles.rowTitle}>{t('compose.trip.none')}</span>
              </span>
              <span className={styles.rowAction}>{t('compose.trip.noneAction')}</span>
            </button>
          </li>
          {trips.map((trip) => {
            const on = trip.id === selectedId;
            return (
              <li key={trip.id}>
                <button type="button" className={`${styles.row} ${on ? styles.rowOn : ''}`} onClick={() => requestClose(() => onSelect(trip.id))} aria-pressed={on}>
                  <TripThumb city={trip.city} />
                  <span className={styles.rowText}>
                    <span className={styles.rowTitle}>{trip.title}</span>
                    <span className={styles.rowSub}>{formatTripPeriod(trip, t('compose.trip.days', { count: trip.total_days ?? 1 }))}</span>
                  </span>
                  {on ? <Check size={18} aria-hidden="true" className={styles.check} /> : <span className={styles.rowAction}>{t('compose.trip.pick')}</span>}
                </button>
              </li>
            );
          })}
        </ul>
        {trips.length === 0 ? <p className={styles.empty}>{t('compose.trip.empty')}</p> : null}

        <div className={styles.footer}>
          <button type="button" className={styles.secondary} onClick={() => requestClose()}>
            {t('picker.close')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
