import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { UseMutationResult } from '@tanstack/react-query';
import type { ProfilePatch, ProfileRow } from '@/shared/api/profileService';
import { SUPPORTED_LOCALES, normalizeLocale, type SupportedLocale } from '@/shared/i18n';
import { LANGUAGE_AUTONYMS } from '@/shared/i18n/languageNames';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import modalStyles from '../plan/AddPlaceModal.module.css';

interface LanguageModalProps {
  onClose: () => void;
  profile: ProfileRow | undefined;
  updateProfile: UseMutationResult<void, Error, ProfilePatch>;
}

/** 표시 언어 변경 — 즉시 반영하고, 로그인 사용자는 프로필에도 저장한다(다른 기기에서도 유지) */
export function LanguageModal({ onClose, profile, updateProfile }: LanguageModalProps) {
  const { t, i18n } = useTranslation(['settings', 'common']);
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);
  const [selectedLocale, setSelectedLocale] = useState<SupportedLocale>(normalizeLocale(i18n.language));

  const handleSave = () => {
    if (selectedLocale !== i18n.language) void i18n.changeLanguage(selectedLocale);
    if (profile && selectedLocale !== profile.locale) updateProfile.mutate({ locale: selectedLocale });
    onClose();
  };

  return (
    <div className={modalStyles.overlay} onClick={onClose}>
      <div
        ref={trapRef}
        className={modalStyles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="language-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="language-title">{t('preferences.language')}</h2>

        <div className={modalStyles.field}>
          <label className={modalStyles.label} htmlFor="language-select">
            {t('preferences.language')}
          </label>
          <select
            id="language-select"
            className={modalStyles.input}
            value={selectedLocale}
            onChange={(e) => setSelectedLocale(e.target.value as SupportedLocale)}
          >
            {SUPPORTED_LOCALES.map((code) => (
              <option key={code} value={code} lang={code}>
                {LANGUAGE_AUTONYMS[code]}
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
