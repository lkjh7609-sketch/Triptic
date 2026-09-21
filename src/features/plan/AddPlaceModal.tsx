import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePlaceAutocomplete, type SelectedPlace } from './map/usePlaceAutocomplete';
import { inferPlaceCategory } from './placeCategory';
import { captureError } from '@/shared/monitoring';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
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
  const { t } = useTranslation(['plan', 'common']);
  const [selected, setSelected] = useState<SelectedPlace | null>(null);
  const [time, setTime] = useState('');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const { inputRef } = usePlaceAutocomplete(setSelected);
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);

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
      <div
        ref={trapRef}
        className={styles.sheet}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('addPlace.title')}
      >
        <h2 className={styles.title}>{t('addPlace.title')}</h2>

        <input
          ref={inputRef}
          className={styles.input}
          placeholder={t('addPlace.searchPlaceholder')}
          aria-label={t('addPlace.searchPlaceholder')}
        />

        {selected ? (
          <div className={styles.selectedCard}>
            <div className={styles.selectedName}>
              {selected.name}
              {category ? <span className={styles.categoryBadge}>{t(`placeCategory.${category}`)}</span> : null}
            </div>
            {selected.address ? <div className={styles.selectedAddress}>{selected.address}</div> : null}
          </div>
        ) : (
          <p className={styles.hint}>{t('addPlace.selectHint')}</p>
        )}

        <div className={styles.field}>
          <label className={styles.label} htmlFor="place-time">
            {t('addPlace.timeLabel')}
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
            {t('addPlace.memoLabel')}
          </label>
          <input
            id="place-memo"
            className={styles.input}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder={t('addPlace.memoPlaceholder')}
          />
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onClose}>
            {t('action.cancel', { ns: 'common' })}
          </button>
          <button
            type="button"
            className={styles.primary}
            disabled={!selected || saving}
            onClick={handleSave}
          >
            {saving ? t('addPlace.adding') : t('action.add', { ns: 'common' })}
          </button>
        </div>
      </div>
    </div>
  );
}
