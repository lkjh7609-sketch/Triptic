import { useState } from 'react';
import { usePlaceAutocomplete, type SelectedPlace } from './map/usePlaceAutocomplete';
import { MEAL_META } from './map/meals';
import { captureError } from '@/shared/monitoring';
import type { DayMeals, MealSlot, MealSlotInfo } from './types';
import styles from './MealsModal.module.css';
import modalStyles from './AddPlaceModal.module.css';

interface MealsModalProps {
  dayMeals: DayMeals;
  onClose: () => void;
  onSave: (dayMeals: DayMeals) => Promise<void>;
}

/**
 * 이 날의 식사 슬롯 (index.html renderMealSection/selectMeal/toggleMealSkip 이식)
 * 아침/점심/저녁 3개 슬롯을 한 시트에서 편집한다 — 슬롯마다 이름을 검색해 지정하거나
 * "건너뛰기"로 표시할 수 있다. 저장하면 TripDetailScreen이 syncMealItemsIntoDay로
 * plannerData[day]에 mealType 항목을 다시 채워 넣는다.
 */
export function MealsModal({ dayMeals, onClose, onSave }: MealsModalProps) {
  const [slots, setSlots] = useState<DayMeals>(dayMeals);
  const [saving, setSaving] = useState(false);

  function updateSlot(slot: MealSlot, info: MealSlotInfo) {
    setSlots((prev) => ({ ...prev, [slot]: info }));
  }

  function selectPlace(slot: MealSlot, place: SelectedPlace) {
    updateSlot(slot, { skip: false, name: place.name, address: place.address, lat: place.lat, lng: place.lng });
  }

  function toggleSkip(slot: MealSlot, checked: boolean) {
    updateSlot(slot, { skip: checked });
  }

  const breakfast = usePlaceAutocomplete((p) => selectPlace('breakfast', p));
  const lunch = usePlaceAutocomplete((p) => selectPlace('lunch', p));
  const dinner = usePlaceAutocomplete((p) => selectPlace('dinner', p));
  const inputRefs: Record<MealSlot, typeof breakfast.inputRef> = {
    breakfast: breakfast.inputRef,
    lunch: lunch.inputRef,
    dinner: dinner.inputRef,
  };

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(slots);
      onClose();
    } catch (err) {
      captureError(err, { context: 'saveMeals' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={modalStyles.overlay} onClick={onClose}>
      <div className={modalStyles.sheet} onClick={(e) => e.stopPropagation()}>
        <h2 className={modalStyles.title}>🍽 이 날의 식사</h2>
        {(Object.keys(MEAL_META) as MealSlot[]).map((slot) => {
          const meta = MEAL_META[slot];
          const info = slots[slot] ?? { skip: false };
          return (
            <div key={slot} className={styles.mealRow}>
              <div className={styles.mealLabel}>
                {meta.emoji} {meta.label}
              </div>
              <input
                ref={inputRefs[slot]}
                className={styles.mealInput}
                placeholder={`${meta.label} 식당 검색`}
                defaultValue={info.name ?? ''}
                disabled={info.skip}
              />
              <label className={styles.mealSkipLabel}>
                <input
                  type="checkbox"
                  checked={!!info.skip}
                  onChange={(e) => toggleSkip(slot, e.target.checked)}
                />
                건너뛰기
              </label>
            </div>
          );
        })}
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
