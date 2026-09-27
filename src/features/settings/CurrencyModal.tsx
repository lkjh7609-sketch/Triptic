import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { UseMutationResult } from '@tanstack/react-query';
import type { ProfilePatch, ProfileRow } from '@/shared/api/profileService';
import { CURRENCIES, currencyName } from '@/features/plan/expenses';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import modalStyles from '../plan/AddPlaceModal.module.css';

interface CurrencyModalProps {
  onClose: () => void;
  profile: ProfileRow | undefined;
  updateProfile: UseMutationResult<void, Error, ProfilePatch>;
}

/** 기본 통화 변경 — 단위/언어 설정과 같은 팝업 방식 */
export function CurrencyModal({ onClose, profile, updateProfile }: CurrencyModalProps) {
  const { t, i18n } = useTranslation(['settings', 'common']);
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);
  const [currency, setCurrency] = useState(profile?.base_currency ?? 'KRW');

  const handleSave = () => {
    if (currency !== (profile?.base_currency ?? 'KRW')) updateProfile.mutate({ base_currency: currency });
    onClose();
  };

  return (
    <div className={modalStyles.overlay} onClick={onClose}>
      <div
        ref={trapRef}
        className={modalStyles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="currency-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="currency-title">{t('preferences.baseCurrency')}</h2>

        <div className={modalStyles.field}>
          <label className={modalStyles.label} htmlFor="currency-select">
            {t('preferences.baseCurrency')}
          </label>
          <select
            id="currency-select"
            className={modalStyles.input}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {Object.entries(CURRENCIES).map(([code, meta]) => (
              <option key={code} value={code}>
                {currencyName(code, i18n.language)} ({code}) - {meta.symbol}
              </option>
            ))}
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
