import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import { usePlaceAutocomplete, type SelectedPlace } from './map/usePlaceAutocomplete';
import { captureError } from '@/shared/monitoring';
import { clearInvalid, flagInvalid } from '@/shared/ui/invalidField';
import type { HotelItem, HotelsData } from './types';
import styles from './SetHotelModal.module.css';
import { Hotel } from 'lucide-react';

interface SetHotelModalProps {
  currentDay: number;
  totalDays: number;
  hotelsData: HotelsData;
  onClose: () => void;
  onSave: (hotels: HotelsData) => Promise<void>;
}

export function SetHotelModal({ currentDay, totalDays, hotelsData, onClose, onSave }: SetHotelModalProps) {
  const { t } = useTranslation(['plan', 'common']);
  const [activeDay, setActiveDay] = useState(currentDay);
  const [draftHotels, setDraftHotels] = useState<HotelsData>(hotelsData);
  const [saving, setSaving] = useState(false);
  const sheetRef = useFocusTrap<HTMLDivElement>();
  const paneRef = useRef<HTMLDivElement>(null);
  const dayTabsRef = useRef<HTMLDivElement>(null);

  // 현재 탭의 숙소
  const currentDraft = draftHotels[activeDay];

  // 전체 적용인지 여부 (모든 날짜가 1일차와 동일한 객체인지 단순 체크)
  // const isAllSame = totalDays > 1 && 
    // draftHotels[1] != null && 
    // Array.from({ length: totalDays }).every((_, i) => JSON.stringify(draftHotels[i + 1]) === JSON.stringify(draftHotels[1]));

  function handleSetForDay(place: SelectedPlace | null) {
    const next = { ...draftHotels };
    if (place) {
      next[activeDay] = { name: place.name, address: place.address, lat: place.lat, lng: place.lng };
    } else {
      delete next[activeDay];
    }
    setDraftHotels(next);
  }

  function applyToAll() {
    if (!draftHotels[activeDay]) {
      flagInvalid(paneRef.current?.querySelector('input'));
      return;
    }
    const hotel = draftHotels[activeDay]!;
    const next: HotelsData = {};
    for (let i = 1; i <= totalDays; i++) {
      next[i] = { ...hotel };
    }
    setDraftHotels(next);
  }

  function copyFromPrevious() {
    if (activeDay <= 1) return;
    const prev = draftHotels[activeDay - 1];
    if (!prev) {
      flagInvalid(dayTabsRef.current?.children[activeDay - 2] as HTMLElement | undefined);
      return;
    }
    const next = { ...draftHotels };
    next[activeDay] = { ...prev };
    setDraftHotels(next);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(draftHotels);
      onClose();
    } catch (err) {
      captureError(err, { context: 'setHotel' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.overlay}>
      <div ref={sheetRef} className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><Hotel size={18} aria-hidden="true" /> {t('hotel.title')}</span></h2>
        
        {totalDays > 1 && (
          <div ref={dayTabsRef} className={styles.dayTabs}>
            {Array.from({ length: totalDays }).map((_, i) => {
              const d = i + 1;
              const hasHotel = !!draftHotels[d];
              return (
                <button
                  key={d}
                  className={`${styles.dayTab} ${activeDay === d ? styles.dayTabActive : ''} ${hasHotel ? styles.dayTabFilled : ''}`}
                  onClick={(e) => {
                    clearInvalid(e.currentTarget);
                    setActiveDay(d);
                  }}
                >
                  {t('day.header', { index: d })}
                </button>
              );
            })}
          </div>
        )}

        <div ref={paneRef} className={styles.pane}>
          <HotelSearchInput 
            key={activeDay} // 탭이 바뀔때마다 input 리셋
            currentHotel={currentDraft ?? null}
            onChange={handleSetForDay} 
          />

          {totalDays > 1 && (
            <div className={styles.bulkActions}>
              <button 
                type="button" 
                className={styles.bulkBtn}
                onClick={applyToAll}
              >
                {t('hotel.applyAll')}
              </button>
              {activeDay > 1 && (
                <button 
                  type="button" 
                  className={styles.bulkBtn}
                  onClick={copyFromPrevious}
                >
                  {t('hotel.sameAsPrevious')}
                </button>
              )}
            </div>
          )}
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onClose}>
            {t('common:action.cancel')}
          </button>
          <button type="button" className={styles.primary} disabled={saving} onClick={handleSave}>
            {saving ? t('flight.saving') : t('common:action.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

function HotelSearchInput({ currentHotel, onChange }: { currentHotel: HotelItem | null, onChange: (p: SelectedPlace | null) => void }) {
  const { t } = useTranslation(['plan', 'common']);
  const [selected, setSelected] = useState<SelectedPlace | null>(
    currentHotel
      ? { name: currentHotel.name, address: currentHotel.address ?? '', lat: currentHotel.lat, lng: currentHotel.lng, placeId: null, types: [] }
      : null,
  );
  
  const { inputRef } = usePlaceAutocomplete((place) => {
    setSelected(place);
    onChange(place);
  });

  return (
    <div className={styles.searchWrap}>
      <input 
        ref={inputRef} 
        className={styles.input} 
        placeholder={t('hotel.searchPlaceholder')}
        aria-label={t('hotel.searchPlaceholder')}
        defaultValue={currentHotel?.name} 
      />
      {selected ? (
        <div className={styles.selectedCard}>
          <div className={styles.selectedName}>{selected.name}</div>
          {selected.address ? <div className={styles.selectedAddress}>{selected.address}</div> : null}
          <button type="button" className={styles.clearBtn} onClick={() => { setSelected(null); onChange(null); }}>
            {t('common:action.delete')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
