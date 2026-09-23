import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePlaceAutocomplete, type SelectedPlace } from './map/usePlaceAutocomplete';
import { captureError } from '@/shared/monitoring';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import type { DayCityInfo } from './types';
import styles from './DayCityModal.module.css';
import modalStyles from './AddPlaceModal.module.css';
import { MapPin, Star } from 'lucide-react';

interface DayCityModalProps {
  currentDay: number;
  totalDays: number;
  currentCity: DayCityInfo;
  onClose: () => void;
  /** scope: 'rest'면 currentDay~totalDays 전체, 'single'이면 currentDay만 (index.html submitDayCityChange 이식) */
  onSave: (city: DayCityInfo, scope: 'rest' | 'single') => Promise<void>;
}

/**
 * 일차별 활동 도시 변경 (index.html openDayCityModal/submitDayCityChange 이식)
 * 도시만 검색되도록 Places Autocomplete를 '(cities)' 타입으로 제한한다.
 */
export function DayCityModal({ currentDay, totalDays, currentCity, onClose, onSave }: DayCityModalProps) {
  const { t } = useTranslation(['plan', 'common']);
  const [selected, setSelected] = useState<SelectedPlace | null>(null);
  const [scope, setScope] = useState<'rest' | 'single'>('rest');
  const [saving, setSaving] = useState(false);
  const { inputRef } = usePlaceAutocomplete(setSelected, { types: ['(cities)'] });
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    try {
      await onSave({ name: selected.name, lat: selected.lat, lng: selected.lng }, scope);
      onClose();
    } catch (err) {
      captureError(err, { context: 'setDayCity' });
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
        aria-label={t('dayCity.title', { day: currentDay })}
      >
        <h2 className={modalStyles.title}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><MapPin size={18} /> {t('dayCity.title', { day: currentDay })}</span></h2>

        <div className={styles.currentBanner}>
          <span className={styles.currentLabel}>{t('dayCity.currentLabel', { day: currentDay })}</span>
          <strong className={styles.currentName}>{currentCity.name || t('dayCity.unset')}</strong>
        </div>

        <input
          ref={inputRef}
          className={modalStyles.input}
          placeholder={t('dayCity.searchPlaceholder')}
        />

        <div className={styles.scopeSection}>
          <label className={`${styles.scopeCard} ${scope === 'rest' ? styles.scopeCardSelected : ''}`}>
            <input
              type="radio"
              name="day-city-scope"
              checked={scope === 'rest'}
              onChange={() => setScope('rest')}
            />
            <div>
              <div className={styles.scopeTitle}>
                {t('dayCity.scopeRestTitle')} <span className={styles.scopeBadge}>{t('dayCity.scopeRestBadge')} <Star size={14} /></span>
              </div>
              <div className={styles.scopeDesc}>
                {t('dayCity.scopeRestDesc', { from: currentDay, to: totalDays })}
              </div>
            </div>
          </label>

          <label className={`${styles.scopeCard} ${scope === 'single' ? styles.scopeCardSelected : ''}`}>
            <input
              type="radio"
              name="day-city-scope"
              checked={scope === 'single'}
              onChange={() => setScope('single')}
            />
            <div>
              <div className={styles.scopeTitle}>{t('dayCity.scopeSingleTitle', { day: currentDay })}</div>
              <div className={styles.scopeDesc}>{t('dayCity.scopeSingleDesc', { day: currentDay })}</div>
            </div>
          </label>
        </div>

        <div className={modalStyles.actions}>
          <button type="button" className={modalStyles.secondary} onClick={onClose}>
            {t('action.cancel', { ns: 'common' })}
          </button>
          <button type="button" className={modalStyles.primary} disabled={!selected || saving} onClick={handleSave}>
            {saving ? t('dayCity.applying') : t('dayCity.apply')}
          </button>
        </div>
      </div>
    </div>
  );
}
