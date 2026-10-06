import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePlaceAutocomplete, type SelectedPlace } from './map/usePlaceAutocomplete';
import { MEAL_META, slotsNeedingTime } from './map/meals';
import { captureError } from '@/shared/monitoring';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import type { DayMeals, MealSlot, MealSlotInfo, PlaceItem } from './types';
import styles from './MealsModal.module.css';
import modalStyles from './AddPlaceModal.module.css';
import { Utensils } from 'lucide-react';
import { TimeWheelPicker } from '@/shared/ui/TimeWheelPicker';

interface MealsModalProps {
  dayMeals: DayMeals;
  /** 그 날 일정 — 새로 정한 식당이 이미 일정에 있는지 보고 방문 시간을 물을지 정한다 */
  dayItems: PlaceItem[];
  /** 그날 도시 중심 — 이 도시 주변 결과만 검색된다 */
  bias?: { lat: number | null; lng: number | null } | null;
  onClose: () => void;
  onSave: (dayMeals: DayMeals, times: Partial<Record<MealSlot, string>>) => Promise<void>;
}

/**
 * 이 날의 식사 슬롯 (index.html renderMealSection/selectMeal/toggleMealSkip 이식)
 * 아침/점심/저녁 3개 슬롯을 한 시트에서 편집한다 — 슬롯마다 이름을 검색해 지정하거나
 * "건너뛰기"로 표시할 수 있다. 새로 정하거나 바꾼 식당이 아래 일정에 아직 없으면 저장할 때
 * 방문 시간을 묻고(두 번째 단계), TripDetailScreen이 applyMealChanges로 그 시간에 일정 항목을 넣는다.
 */
export function MealsModal({ dayMeals, dayItems, bias, onClose, onSave }: MealsModalProps) {
  const { t } = useTranslation(['plan', 'common']);
  const [slots, setSlots] = useState<DayMeals>(dayMeals);
  const [saving, setSaving] = useState(false);
  // 2단계: 새로 정한 식당의 방문 시간 — 묻는 슬롯 목록과 고른 시간
  const [askSlots, setAskSlots] = useState<MealSlot[] | null>(null);
  const [times, setTimes] = useState<Partial<Record<MealSlot, string>>>({});
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);

  function updateSlot(slot: MealSlot, info: MealSlotInfo) {
    setSlots((prev) => ({ ...prev, [slot]: info }));
  }

  function selectPlace(slot: MealSlot, place: SelectedPlace) {
    updateSlot(slot, { skip: false, name: place.name, address: place.address, lat: place.lat, lng: place.lng, placeId: place.placeId });
  }

  function toggleSkip(slot: MealSlot, checked: boolean) {
    updateSlot(slot, { skip: checked });
  }

  const breakfast = usePlaceAutocomplete((p) => selectPlace('breakfast', p), { bias });
  const lunch = usePlaceAutocomplete((p) => selectPlace('lunch', p), { bias });
  const dinner = usePlaceAutocomplete((p) => selectPlace('dinner', p), { bias });
  const inputRefs: Record<MealSlot, typeof breakfast.inputRef> = {
    breakfast: breakfast.inputRef,
    lunch: lunch.inputRef,
    dinner: dinner.inputRef,
  };

  function handleSaveClick() {
    const ask = slotsNeedingTime(dayItems, dayMeals, slots);
    if (ask.length > 0) {
      setTimes(Object.fromEntries(ask.map((slot) => [slot, MEAL_META[slot].time])));
      setAskSlots(ask);
      return;
    }
    void handleSave({});
  }

  async function handleSave(chosen: Partial<Record<MealSlot, string>>) {
    setSaving(true);
    try {
      await onSave(slots, chosen);
      onClose();
    } catch (err) {
      captureError(err, { context: 'saveMeals' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={modalStyles.overlay}>
      <div
        ref={trapRef}
        className={modalStyles.sheet}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('meals.title')}
      >
        <h2 className={modalStyles.title}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><Utensils size={18} /> {t('meals.title')}</span></h2>
        {askSlots ? (
          <>
            <p className={styles.timeHint}>{t('meals.timeTitle')}</p>
            {askSlots.map((slot) => (
              <div key={slot} className={styles.timeBlock}>
                <div className={styles.timeLabel}>
                  <strong>{t(`mealSlot.${slot}`)}</strong>
                  <span className={styles.timePlace}>{slots[slot]?.name}</span>
                </div>
                <TimeWheelPicker value={times[slot] ?? MEAL_META[slot].time} onChange={(v) => setTimes((prev) => ({ ...prev, [slot]: v }))} />
              </div>
            ))}
            <div className={modalStyles.actions}>
              <button type="button" className={modalStyles.secondary} disabled={saving} onClick={() => setAskSlots(null)}>
                {t('meals.back')}
              </button>
              <button type="button" className={modalStyles.primary} disabled={saving} onClick={() => void handleSave(times)}>
                {saving ? t('meals.saving') : t('meals.confirm')}
              </button>
            </div>
          </>
        ) : (
          <>
        {(Object.keys(MEAL_META) as MealSlot[]).map((slot) => {
          
          const mealLabel = t(`mealSlot.${slot}`);
          const info = slots[slot] ?? { skip: false };
          return (
            <div key={slot} className={styles.mealRow}>
              <div className={styles.mealLabel}>
                {mealLabel}
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
          <button type="button" className={modalStyles.primary} disabled={saving} onClick={handleSaveClick}>
            {saving ? t('meals.saving') : t('action.save', { ns: 'common' })}
          </button>
        </div>
          </>
        )}
      </div>
    </div>
  );
}
