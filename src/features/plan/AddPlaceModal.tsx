import { useState } from 'react';
import { usePlaceAutocomplete, type SelectedPlace } from './map/usePlaceAutocomplete';
import { inferPlaceCategory, CATEGORY_LABEL } from './placeCategory';
import { captureError } from '@/shared/monitoring';
import type { PlaceItem } from './types';
import styles from './AddPlaceModal.module.css';

interface AddPlaceModalProps {
  onClose: () => void;
  onAdd: (item: PlaceItem) => Promise<void>;
}

/**
 * 일정 추가 (02-screens.md §3.4)
 * 좌표 없는 항목은 저장하지 않는다 — legacy 앱은 저장 시점에 조용히 삭제했지만
 * (index.html saveData/renderList), 3.0은 입력 단계에서 막는다(스펙 명시).
 */
export function AddPlaceModal({ onClose, onAdd }: AddPlaceModalProps) {
  const [selected, setSelected] = useState<SelectedPlace | null>(null);
  const [time, setTime] = useState('');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const { inputRef } = usePlaceAutocomplete(setSelected);

  const category = selected ? inferPlaceCategory(selected.types) : null;

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    try {
      await onAdd({
        key: crypto.randomUUID(),
        name: selected.name,
        address: selected.address,
        lat: selected.lat,
        lng: selected.lng,
        placeId: selected.placeId,
        time: time || undefined,
        memo: memo || undefined,
        category: category ?? undefined,
      });
      onClose();
    } catch (err) {
      captureError(err, { context: 'addPlace' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>일정 추가</h2>

        <input
          ref={inputRef}
          className={styles.input}
          placeholder="장소 검색"
          aria-label="장소 검색"
        />

        {selected ? (
          <div className={styles.selectedCard}>
            <div className={styles.selectedName}>
              {selected.name}
              {category ? <span className={styles.categoryBadge}>{CATEGORY_LABEL[category]}</span> : null}
            </div>
            {selected.address ? <div className={styles.selectedAddress}>{selected.address}</div> : null}
          </div>
        ) : (
          <p className={styles.hint}>검색 결과 목록에서 장소를 선택해 주세요.</p>
        )}

        <div className={styles.field}>
          <label className={styles.label} htmlFor="place-time">
            시간 (선택)
          </label>
          <input
            id="place-time"
            type="time"
            className={styles.input}
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="place-memo">
            메모 (선택)
          </label>
          <input
            id="place-memo"
            className={styles.input}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="체크인 후 짐 보관"
          />
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className={styles.primary}
            disabled={!selected || saving}
            onClick={handleSave}
          >
            {saving ? '추가하는 중…' : '추가'}
          </button>
        </div>
      </div>
    </div>
  );
}
