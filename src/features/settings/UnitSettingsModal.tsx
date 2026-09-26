import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Thermometer, Map } from 'lucide-react';
import type { UseMutationResult } from '@tanstack/react-query';
import type { ProfilePatch, ProfileRow } from '@/shared/api/profileService';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import modalStyles from '../plan/AddPlaceModal.module.css';

interface UnitSettingsModalProps {
  onClose: () => void;
  profile: ProfileRow | undefined;
  updateProfile: UseMutationResult<void, Error, ProfilePatch>;
}

export function UnitSettingsModal({ onClose, profile, updateProfile }: UnitSettingsModalProps) {
  const { t } = useTranslation(['settings', 'common']);
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);
  const [tempUnit, setTempUnit] = useState<ProfileRow['temp_unit']>(profile?.temp_unit ?? 'c');
  const [distUnit, setDistUnit] = useState<ProfileRow['distance_unit']>(profile?.distance_unit ?? 'km');

  const handleSave = () => {
    updateProfile.mutate({ temp_unit: tempUnit, distance_unit: distUnit });
    onClose();
  };

  return (
    <div className={modalStyles.overlay} onClick={onClose}>
      <div
        ref={trapRef}
        className={modalStyles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="unit-settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="unit-settings-title">{t('units.title')}</h2>
        <div className={modalStyles.field}>
          <label className={modalStyles.label} htmlFor="unit-temp">
            <Thermometer size={16} aria-hidden="true" /> {t('units.temperature')}
          </label>
          <select
            id="unit-temp"
            className={modalStyles.input}
            value={tempUnit}
            onChange={(e) => setTempUnit(e.target.value as ProfileRow['temp_unit'])}
          >
            <option value="c">{t('units.celsius')}</option>
            <option value="f">{t('units.fahrenheit')}</option>
          </select>
        </div>
        <div className={modalStyles.field}>
          <label className={modalStyles.label} htmlFor="unit-distance">
            <Map size={16} aria-hidden="true" /> {t('units.distance')}
          </label>
          <select
            id="unit-distance"
            className={modalStyles.input}
            value={distUnit}
            onChange={(e) => setDistUnit(e.target.value as ProfileRow['distance_unit'])}
          >
            <option value="km">{t('units.kilometers')}</option>
            <option value="mi">{t('units.miles')}</option>
          </select>
        </div>
        <div className={modalStyles.actions}>
          <button type="button" className={modalStyles.secondary} onClick={onClose}>
            {t('common:action.cancel')}
          </button>
          <button type="button" className={modalStyles.primary} onClick={handleSave}>
            {t('common:action.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
