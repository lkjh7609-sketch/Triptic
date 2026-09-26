import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Locale } from '@/shared/api/profileService';
import modalStyles from '../plan/AddPlaceModal.module.css';

interface Props {
  onClose: () => void;
  profile: any;
  updateProfile: any;
}

export function LanguageModal({ onClose, profile, updateProfile }: Props) {
  const { t, i18n } = useTranslation('settings');
  const [selectedLocale, setSelectedLocale] = useState<string>(i18n.language || profile?.locale || 'ko');

  const handleSave = () => {
    if (selectedLocale !== i18n.language) {
      void i18n.changeLanguage(selectedLocale);
    }
    if (profile && selectedLocale !== profile.locale) {
      updateProfile.mutate({ locale: selectedLocale as Locale });
    }
    onClose();
  };

  return (
    <div className={modalStyles.overlay} onClick={onClose}>
      <div className={modalStyles.sheet} onClick={e => e.stopPropagation()}>
        <h2>{t('preferences.language') || '언어 설정'}</h2>
        
        <div className={modalStyles.field} style={{ marginTop: 16 }}>
          <label className={modalStyles.label}>{t('preferences.language') || '언어'}</label>
          <select
            className={modalStyles.input}
            value={selectedLocale}
            onChange={(e) => setSelectedLocale(e.target.value as Locale)}
          >
            <option value="ko">한국어</option>
            <option value="en">English</option>
            <option value="zh-CN">简体中文</option>
            <option value="ja">日本語</option>
          </select>
        </div>

        <div className={modalStyles.actions} style={{ marginTop: 24 }}>
          <button type="button" className={modalStyles.secondary} onClick={onClose}>
            {t('common:cancel', { defaultValue: '취소' })}
          </button>
          <button type="button" className={modalStyles.primary} onClick={handleSave}>
            {t('common:save', { defaultValue: '저장' })}
          </button>
        </div>
      </div>
    </div>
  );
}
