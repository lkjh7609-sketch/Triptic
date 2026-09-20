import { useState } from 'react';
import { usePlaceAutocomplete, type SelectedPlace } from './map/usePlaceAutocomplete';
import { captureError } from '@/shared/monitoring';
import type { HotelItem } from './types';
import styles from './AddPlaceModal.module.css';

interface SetHotelModalProps {
  currentHotel: HotelItem | null;
  onClose: () => void;
  onSave: (hotel: HotelItem | null) => Promise<void>;
}

/**
 * 숙소 지정 (index.html hotelAutocomplete 이식)
 * ⚠️ 02-screens.md §3.2의 액션 칩 목록(+ 항공편/가계부/+ 서류)에는 숙소가 없다 —
 * 스펙은 정규화 스키마(itinerary_items.type='lodging')를 전제로 작성됐지만,
 * 이 라운드는 아직 snapshot(hotelsData[day]) 구조를 쓴다(Phase 2 진행 중, 실제
 * 데이터 이관 전). getDayHotels/useTripRoutes가 이미 hotelsData 기반으로 동작
 * 하므로, 패리티(지도 경로가 숙소를 출발/도착점으로 삼는 것)를 지금 확인하려면
 * 이 필드를 채우는 입구가 필요하다 — 위치는 후속 라운드에서 액션 칩으로 옮긴다.
 */
export function SetHotelModal({ currentHotel, onClose, onSave }: SetHotelModalProps) {
  const [selected, setSelected] = useState<SelectedPlace | null>(
    currentHotel
      ? { name: currentHotel.name, address: currentHotel.address ?? '', lat: currentHotel.lat, lng: currentHotel.lng, placeId: null, types: [] }
      : null,
  );
  const [saving, setSaving] = useState(false);
  const { inputRef } = usePlaceAutocomplete(setSelected);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(selected ? { name: selected.name, address: selected.address, lat: selected.lat, lng: selected.lng } : null);
      onClose();
    } catch (err) {
      captureError(err, { context: 'setHotel' });
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    setSaving(true);
    try {
      await onSave(null);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>🏨 숙소 지정</h2>
        <input ref={inputRef} className={styles.input} placeholder="숙소 검색" defaultValue={currentHotel?.name} />
        {selected ? (
          <div className={styles.selectedCard}>
            <div className={styles.selectedName}>{selected.name}</div>
            {selected.address ? <div className={styles.selectedAddress}>{selected.address}</div> : null}
          </div>
        ) : null}
        <div className={styles.actions}>
          {currentHotel ? (
            <button type="button" className={styles.secondary} disabled={saving} onClick={handleClear}>
              숙소 해제
            </button>
          ) : (
            <button type="button" className={styles.secondary} onClick={onClose}>
              취소
            </button>
          )}
          <button type="button" className={styles.primary} disabled={!selected || saving} onClick={handleSave}>
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
