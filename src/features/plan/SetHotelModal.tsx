import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import { usePlaceAutocomplete, type SelectedPlace } from './map/usePlaceAutocomplete';
import { captureError } from '@/shared/monitoring';
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
  const { t: _t } = useTranslation(['plan', 'common']);
  const [activeDay, setActiveDay] = useState(currentDay);
  const [draftHotels, setDraftHotels] = useState<HotelsData>(hotelsData);
  const [saving, setSaving] = useState(false);
  const sheetRef = useFocusTrap<HTMLDivElement>();

  // 현재 탭의 숙소
  const currentDraft = draftHotels[activeDay];

  // 전체 적용인지 여부 (모든 날짜가 1일차와 동일한 객체인지 단순 체크)
  // const isAllSame = totalDays > 1 && 
    draftHotels[1] != null && 
    Array.from({ length: totalDays }).every((_, i) => JSON.stringify(draftHotels[i + 1]) === JSON.stringify(draftHotels[1]));

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
    if (!draftHotels[activeDay]) return;
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
    if (!prev) return;
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
    <div className={styles.overlay} onClick={onClose}>
      <div ref={sheetRef} className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><Hotel size={18} /> 숙소 설정</span></h2>
        
        {totalDays > 1 && (
          <div className={styles.dayTabs}>
            {Array.from({ length: totalDays }).map((_, i) => {
              const d = i + 1;
              const hasHotel = !!draftHotels[d];
              return (
                <button
                  key={d}
                  className={`${styles.dayTab} ${activeDay === d ? styles.dayTabActive : ''} ${hasHotel ? styles.dayTabFilled : ''}`}
                  onClick={() => setActiveDay(d)}
                >
                  {d}일차
                </button>
              );
            })}
          </div>
        )}

        <div className={styles.pane}>
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
                disabled={!draftHotels[activeDay]} 
                onClick={applyToAll}
              >
                전체 일정 동일하게 적용
              </button>
              {activeDay > 1 && (
                <button 
                  type="button" 
                  className={styles.bulkBtn} 
                  disabled={!draftHotels[activeDay - 1]} 
                  onClick={copyFromPrevious}
                >
                  전날과 같음
                </button>
              )}
            </div>
          )}
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onClose}>
            취소
          </button>
          <button type="button" className={styles.primary} disabled={saving} onClick={handleSave}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

function HotelSearchInput({ currentHotel, onChange }: { currentHotel: HotelItem | null, onChange: (p: SelectedPlace | null) => void }) {
  const { t: _t } = useTranslation('plan');
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
        placeholder="숙소 이름을 검색하세요" 
        defaultValue={currentHotel?.name} 
      />
      {selected ? (
        <div className={styles.selectedCard}>
          <div className={styles.selectedName}>{selected.name}</div>
          {selected.address ? <div className={styles.selectedAddress}>{selected.address}</div> : null}
          <button type="button" className={styles.clearBtn} onClick={() => { setSelected(null); onChange(null); }}>
            삭제
          </button>
        </div>
      ) : null}
    </div>
  );
}
