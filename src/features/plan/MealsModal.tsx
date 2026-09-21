import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePlaceAutocomplete, type SelectedPlace } from './map/usePlaceAutocomplete';
import { MEAL_META } from './map/meals';
import { captureError } from '@/shared/monitoring';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
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
  const { t } = useTranslation(['plan', 'common']);
  const [slots, setSlots] = useState<DayMeals>(dayMeals);
  const [saving, setSaving] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);

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
      <div
        ref={trapRef}
        className={modalStyles.sheet}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('meals.title')}
      >
        <h2 className={modalStyles.title}>🍽 {t('meals.title')}</h2>
        {(Object.keys(MEAL_META) as MealSlot[]).map((slot) => {
          const meta = MEAL_META[slot];
          const mealLabel = t(`mealSlot.${slot}`);
          const info = slots[slot] ?? { skip: false };
          return (
            <div key={slot} className={styles.mealRow}>
              <div className={styles.mealLabel}>
                {meta.emoji} {mealLabel}
              </div>
              <input
                ref={inputRefs[slot]}
                className={styles.mealInput}
                placeholder={t('meals.searchPlaceholder', { meal: mealLabel })}
                defaultValue={info.name ?? ''}
                disabled={info.skip}
              />
              <label className={styles.mealSkipLabel}>
                <input
                  type="checkbox"
                  checked={!!info.skip}
                  onChange={(e) => toggleSkip(slot, e.target.checked)}
                />
                {t('meals.skip')}
              </label>
            </div>
          );
        })}
        <div className={modalStyles.actions}>
          <button type="button" className={modalStyles.secondary} onClick={onClose}>
            {t('action.cancel', { ns: 'common' })}
          </button>
          <button type="button" className={modalStyles.primary} disabled={saving} onClick={handleSave}>
            {saving ? t('meals.saving') : t('action.save', { ns: 'common' })}
          </button>
        </div>
      </div>
    </div>
  );
}
